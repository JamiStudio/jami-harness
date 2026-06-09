import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultPolicyEngine, createPolicyGatedRunKernel } from "../src/index.mjs";

const now = () => new Date("2026-06-09T12:00:00.000Z");

function baseRequest(overrides = {}) {
  return {
    runId: "run_policy_fixture",
    actor: {
      actorId: "actor_developer",
      scopes: ["repo:read", "tool:filesystem:write", "release:publish"],
    },
    projectId: "proj_jami_harness",
    environment: "local",
    action: {
      actionId: "act_publish_release",
      risk: "external",
      confirmationMode: "approval_required",
    },
    requiredScopes: ["release:publish"],
    approval: {
      approvalId: "apr_publish_release",
      status: "approved",
      runId: "run_policy_fixture",
      actorId: "actor_developer",
      actionId: "act_publish_release",
      scopes: ["release:publish"],
      approvedAt: "2026-06-09T11:59:00.000Z",
      expiresAt: "2026-06-09T12:10:00.000Z",
    },
    ...overrides,
  };
}

test("allows an elevated action only when scopes and bound approval are valid", () => {
  const engine = createDefaultPolicyEngine({ now });
  const decision = engine.evaluate(baseRequest());

  assert.equal(decision.decision, "allow");
  assert.equal(decision.approvalRef, "apr_publish_release");
  assert.deepEqual(decision.matchedScopes, ["release:publish"]);
});

test("fails closed on missing scopes", () => {
  const engine = createDefaultPolicyEngine({ now });
  const decision = engine.evaluate(baseRequest({ actor: { actorId: "actor_developer", scopes: ["repo:read"] } }));

  assert.equal(decision.decision, "deny");
  assert.match(decision.reasons.join("\n"), /missing required scopes/);
});

test("requires approval for elevated actions", () => {
  const engine = createDefaultPolicyEngine({ now });
  const decision = engine.evaluate(baseRequest({ approval: undefined }));

  assert.equal(decision.decision, "needs_approval");
});

test("denies approval replay and expired approvals", () => {
  const engine = createDefaultPolicyEngine({ now });
  const replay = engine.evaluate(baseRequest({ approval: { ...baseRequest().approval, status: "replayed" } }));
  const expired = engine.evaluate(baseRequest({ approval: { ...baseRequest().approval, expiresAt: "2026-06-09T11:59:30.000Z" } }));

  assert.equal(replay.decision, "deny");
  assert.match(replay.reasons.join("\n"), /approval replay/);
  assert.equal(expired.decision, "deny");
  assert.match(expired.reasons.join("\n"), /expired/);
});

test("denies prompt injection, poisoned tool metadata, unsafe MCP transport, and secret exfiltration", () => {
  const engine = createDefaultPolicyEngine({ now });
  const decision = engine.evaluate(baseRequest({
    threatSignals: {
      promptInjection: true,
      toolMetadataPoisoning: true,
      secretExfiltration: true,
    },
    transport: {
      kind: "mcp_streamable_http",
      originTrusted: false,
      sessionBound: false,
      audience: "",
      localhostBinding: "public",
    },
  }));

  assert.equal(decision.decision, "deny");
  assert.match(decision.reasons.join("\n"), /prompt injection/);
  assert.match(decision.reasons.join("\n"), /tool metadata poisoning/);
  assert.match(decision.reasons.join("\n"), /MCP Streamable HTTP/);
  assert.match(decision.reasons.join("\n"), /secret exfiltration/);
});

test("redacts and denies serialized secret values", () => {
  const engine = createDefaultPolicyEngine({ now });
  const decision = engine.evaluate(baseRequest({
    secretRefs: [
      {
        secretId: "sec_github_token",
        provider: "env",
        value: "redacted-example-value",
      },
    ],
  }));

  assert.equal(decision.decision, "deny");
  assert.ok(decision.redactions.some((redaction) => redaction.field.endsWith(".value")));
});

test("policy-gated run kernel emits audit evidence without executing denied actions", async () => {
  const auditEvents = [];
  const kernel = createPolicyGatedRunKernel({
    policyEngine: createDefaultPolicyEngine({ now }),
    auditSink: {
      write(event) {
        auditEvents.push(event);
      },
    },
  });

  const result = await kernel.gateAction(baseRequest({ threatSignals: { promptInjection: true } }));

  assert.equal(result.executable, false);
  assert.equal(result.decision.decision, "deny");
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].outcome, "deny");
  assert.equal(auditEvents[0].redactionMode, "redacted");
});

test("malformed requests fail closed with typed denial evidence", async () => {
  const auditEvents = [];
  const kernel = createPolicyGatedRunKernel({
    policyEngine: createDefaultPolicyEngine({ now }),
    auditSink: {
      write(event) {
        auditEvents.push(event);
      },
    },
  });

  const result = await kernel.gateAction({
    action: {
      actionId: "invalid publish action",
      risk: "network_admin",
    },
    requiredScopes: "release:publish",
    actor: {
      scopes: "release:publish",
    },
  });

  assert.equal(result.executable, false);
  assert.equal(result.decision.decision, "deny");
  assert.equal(result.decision.runId, "run_unknown");
  assert.equal(result.decision.actorId, "actor_unknown");
  assert.equal(result.decision.projectId, "proj_unknown");
  assert.equal(result.decision.environment, "unknown");
  assert.equal(result.decision.risk, "unknown");
  assert.match(result.decision.auditRef, /^aud_[a-z0-9][a-z0-9_-]*$/);
  assert.match(result.decision.evidenceRef, /^ev_[a-z0-9][a-z0-9_-]*$/);
  assert.match(result.decision.reasons.join("\n"), /actor identity is required/);
  assert.match(result.decision.reasons.join("\n"), /project identity is required/);
  assert.match(result.decision.reasons.join("\n"), /environment is required/);
  assert.match(result.decision.reasons.join("\n"), /required scopes must be an array/);
  assert.match(result.decision.reasons.join("\n"), /actor scopes must be an array/);
  assert.match(result.decision.reasons.join("\n"), /unsupported action risk/);

  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].runId, "run_unknown");
  assert.equal(auditEvents[0].actorId, "actor_unknown");
  assert.equal(auditEvents[0].projectId, "proj_unknown");
  assert.equal(auditEvents[0].environment, "unknown");
  assert.equal(auditEvents[0].outcome, "deny");
  assert.equal(auditEvents[0].redactionMode, "redacted");
});
