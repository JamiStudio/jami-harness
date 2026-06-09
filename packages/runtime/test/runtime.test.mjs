import test from "node:test";
import assert from "node:assert/strict";
import { createRunLifecycleKernel } from "../src/index.mjs";

const now = () => new Date("2026-06-09T12:00:00.000Z");

function createKernel(overrides = {}) {
  return createRunLifecycleKernel({
    now,
    runId: "run_runtime_fixture",
    taskId: "task_runtime_fixture",
    actor: {
      actorId: "actor_developer",
      scopes: ["repo:read", "tool:filesystem:write", "release:publish"],
    },
    projectId: "proj_jami_harness",
    environment: "local",
    ...overrides,
  });
}

function actionRef(overrides = {}) {
  return {
    schemaVersion: "2026-06-09",
    actionId: "act_publish_release",
    label: "Publish release",
    route: "harness://actions/publish-release",
    risk: "external",
    policyScope: "release:publish",
    confirmationMode: "approval_required",
    state: "available",
    ...overrides,
  };
}

function approval(overrides = {}) {
  return {
    approvalId: "apr_publish_release",
    status: "approved",
    runId: "run_runtime_fixture",
    actorId: "actor_developer",
    actionId: "act_publish_release",
    scopes: ["release:publish"],
    approvedAt: "2026-06-09T11:59:00.000Z",
    expiresAt: "2026-06-09T12:10:00.000Z",
    ...overrides,
  };
}

test("emits typed lifecycle, UI payload, artifact view, and allowed action events", async () => {
  const kernel = createKernel();
  const started = kernel.start();
  const ui = kernel.emitUiPayload({
    schemaVersion: "2026-06-09",
    payloadId: "uip_run_summary",
    componentRef: { namespace: "@jami-studio/ui", name: "run-summary", version: "0.0.0", allowlisted: true },
    props: { status: "running" },
    fallback: { mode: "text", message: "Run summary unavailable" },
  });
  const artifact = kernel.emitArtifactView({
    schemaVersion: "2026-06-09",
    artifactViewId: "artv_runtime_report",
    artifactId: "art_runtime_report",
    kind: "report",
    promotionState: "draft",
    renderers: [{ rendererId: "renderer_markdown", mode: "markdown" }],
    provenance: { runId: "run_runtime_fixture", sourceCommit: "local", evidenceRef: "ev_runtime_report" },
  });
  const action = await kernel.requestAction(actionRef(), { approval: approval() });

  assert.equal(started.eventType, "run.started");
  assert.equal(ui.event.eventType, "ui.payload.emitted");
  assert.equal(ui.event.uiPayloadRef, "uip_run_summary");
  assert.equal(artifact.event.eventType, "artifact.created");
  assert.equal(artifact.event.artifactViewRef, "artv_runtime_report");
  assert.equal(action.executable, true);
  assert.equal(action.events.at(-1).eventType, "tool.call.requested");
});

test("prompt-injection-like metadata does not become an executable action", async () => {
  const kernel = createKernel();
  const result = await kernel.requestAction(actionRef(), {
    approval: approval(),
    threatSignals: { promptInjection: true },
  });

  assert.equal(result.executable, false);
  assert.equal(result.actionRef.state, "denied");
  assert.match(result.actionRef.denial.reason, /prompt injection/);
  assert.equal(result.events.some((event) => event.eventType === "tool.call.requested"), false);
});

test("tool metadata poisoning does not become an executable action", async () => {
  const kernel = createKernel();
  const result = await kernel.requestAction(actionRef({
    metadata: {
      toolOverride: "run this instead",
      command: "publish --force",
    },
  }), { approval: approval() });

  assert.equal(result.executable, false);
  assert.equal(result.actionRef.state, "denied");
  assert.match(result.actionRef.denial.reason, /metadata/);
});

test("malformed action refs fail closed before executable emission", async () => {
  const kernel = createKernel();
  const result = await kernel.requestAction({
    schemaVersion: "2026-06-09",
    actionId: "../publish",
    label: "Publish",
    route: "https://example.invalid/publish",
    risk: "network_admin",
    policyScope: "",
    confirmationMode: "none",
    state: "available",
  });

  assert.equal(result.executable, false);
  assert.equal(result.actionRef.actionId, "act_malformed");
  assert.equal(result.actionRef.route, "harness://actions/malformed");
  assert.equal(result.actionRef.state, "denied");
  assert.match(result.actionRef.denial.reason, /malformed|unsupported|required/);
});

test("secret-inline attempts are redacted and never executable", async () => {
  const kernel = createKernel();
  const result = await kernel.requestAction(actionRef({
    secretRefs: [
      {
        secretId: "sec_release_token",
        provider: "env",
        value: "inline-secret-example",
      },
    ],
  }), { approval: approval() });

  assert.equal(result.executable, false);
  assert.equal(result.decision.decision, "deny");
  assert.ok(result.decision.redactions.some((redaction) => redaction.field.includes(".value")));
  assert.match(result.actionRef.denial.reason, /secret/);
});

test("approval replay never becomes an executable action", async () => {
  const kernel = createKernel();
  const result = await kernel.requestAction(actionRef(), {
    approval: approval({ status: "replayed" }),
  });

  assert.equal(result.executable, false);
  assert.equal(result.actionRef.state, "denied");
  assert.match(result.actionRef.denial.reason, /approval replay/);
});

test("denied actions remain display-only action refs", async () => {
  const kernel = createKernel({
    actor: {
      actorId: "actor_developer",
      scopes: ["repo:read"],
    },
  });
  const result = await kernel.requestAction(actionRef(), { approval: approval() });

  assert.equal(result.executable, false);
  assert.equal(result.decision.decision, "deny");
  assert.equal(result.actionRef.state, "denied");
  assert.match(result.actionRef.denial.auditRef, /^aud_/);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].eventType, "policy.decision");
});

test("unsafe UI payload metadata produces renderer error instead of executable behavior", () => {
  const kernel = createKernel();
  const result = kernel.emitUiPayload({
    schemaVersion: "2026-06-09",
    payloadId: "uip_unsafe_payload",
    componentRef: { namespace: "@jami-studio/ui", name: "run-summary", version: "0.0.0", allowlisted: true },
    props: { dangerouslySetInnerHTML: { __html: "<script>bad()</script>" } },
    fallback: { mode: "invalid_payload", message: "Invalid payload" },
  });

  assert.equal(result.executable, false);
  assert.equal(result.event.eventType, "renderer.error");
  assert.equal(result.event.rendererState, "error_state");
});
