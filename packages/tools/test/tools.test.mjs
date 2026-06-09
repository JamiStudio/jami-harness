import test from "node:test";
import assert from "node:assert/strict";
import { createFunctionTool, createToolGateway, createToolRegistry } from "../src/index.mjs";

const now = () => new Date("2026-06-09T12:00:00.000Z");

function approval(overrides = {}) {
  return {
    approvalId: "apr_write_file",
    status: "approved",
    runId: "run_tool_gateway",
    actorId: "actor_developer",
    actionId: "act_write_file",
    scopes: ["tool:filesystem:write"],
    approvedAt: "2026-06-09T11:59:00.000Z",
    expiresAt: "2026-06-09T12:10:00.000Z",
    ...overrides,
  };
}

function actor(scopes = ["repo:read", "tool:filesystem:write"]) {
  return { actorId: "actor_developer", scopes };
}

test("executes a registered function tool only after policy allows it", async () => {
  let invoked = 0;
  const registry = createToolRegistry();
  registry.register(createFunctionTool({
    toolId: "tool_write_file",
    label: "Write file",
    risk: "write",
    requiredScopes: ["tool:filesystem:write"],
    timeoutMs: 1000,
    handler(input) {
      invoked += 1;
      return { ok: true, token: input.token, nested: { apiKey: "redaction-fixture-result" } };
    },
  }));
  const gateway = createToolGateway({ now, registry });

  const result = await gateway.execute({
    runId: "run_tool_gateway",
    toolId: "tool_write_file",
    actor: actor(),
    projectId: "proj_jami_harness",
    environment: "local",
    input: { path: "docs/example.md", token: "redaction-fixture-input" },
    approval: approval(),
  });

  assert.equal(invoked, 1);
  assert.equal(result.executable, true);
  assert.equal(result.status, "completed");
  assert.equal(result.execution.status, "completed");
  assert.equal(result.execution.redaction.inputPolicy, "redacted");
  assert.equal(result.execution.redaction.resultPolicy, "redacted");
  assert.deepEqual(result.trace.attributes.input, { path: "docs/example.md", token: "[redacted]" });
  assert.equal(result.trace.attributes.result.token, "[redacted]");
  assert.equal(result.artifact.redaction.classification, "secret_adjacent");
  assert.equal(result.evidence.acceptedContracts.some((contract) => contract.name === "toolExecution"), true);
});

test("denied actions do not invoke handlers", async () => {
  let invoked = 0;
  const registry = createToolRegistry();
  registry.register(createFunctionTool({
    toolId: "tool_write_file",
    label: "Write file",
    risk: "write",
    requiredScopes: ["tool:filesystem:write"],
    handler() {
      invoked += 1;
      return { ok: true };
    },
  }));
  const gateway = createToolGateway({ now, registry });

  const result = await gateway.execute({
    runId: "run_tool_gateway",
    toolId: "tool_write_file",
    actor: actor(["repo:read"]),
    projectId: "proj_jami_harness",
    environment: "local",
    input: { path: "docs/example.md" },
  });

  assert.equal(invoked, 0);
  assert.equal(result.executable, false);
  assert.equal(result.status, "denied");
  assert.equal(result.auditEvent.eventType, "tool.denied");
  assert.equal(result.execution.error.code, "policy_denied");
});

test("unsupported adapters fail closed with capability manifests and no handler path", async () => {
  const registry = createToolRegistry();
  registry.register({
    toolId: "tool_mcp_fixture",
    label: "MCP fixture",
    adapterId: "adapter_mcp",
    risk: "read",
    requiredScopes: ["repo:read"],
  });
  const gateway = createToolGateway({ now, registry });

  const result = await gateway.execute({
    runId: "run_tool_gateway",
    toolId: "tool_mcp_fixture",
    actor: actor(["repo:read"]),
    projectId: "proj_jami_harness",
    environment: "local",
    input: { resource: "fixture" },
  });

  assert.equal(result.executable, false);
  assert.equal(result.status, "unsupported");
  assert.equal(result.execution.error.code, "adapter_unsupported");
  assert.equal(registry.manifests().some((manifest) => manifest.capabilityId === "cap_mcp_tool_gateway"), true);
  assert.equal(
    registry.manifests()
      .find((manifest) => manifest.capabilityId === "cap_mcp_tool_gateway")
      .features.some((feature) => feature.featureId === "execution_envelope" && feature.support === "unsupported"),
    true,
  );
});

test("trace, evidence, and artifact records represent timeout and cancellation", async () => {
  const registry = createToolRegistry();
  registry.register(createFunctionTool({
    toolId: "tool_slow_read",
    label: "Slow read",
    risk: "read",
    requiredScopes: ["repo:read"],
    timeoutMs: 1,
    handler(_input, context) {
      return new Promise((_resolve, reject) => {
        context.signal.addEventListener("abort", () => reject(context.signal.reason), { once: true });
      });
    },
  }));
  const gateway = createToolGateway({ now, registry });

  const result = await gateway.execute({
    runId: "run_tool_gateway",
    toolId: "tool_slow_read",
    actor: actor(["repo:read"]),
    projectId: "proj_jami_harness",
    environment: "local",
    input: { query: "status" },
  });

  assert.equal(result.executable, false);
  assert.equal(result.status, "timeout");
  assert.equal(result.trace.kind, "tool");
  assert.equal(result.trace.status, "error");
  assert.equal(result.execution.timeoutMs, 1);
  assert.equal(result.execution.redaction.resultPolicy, "omitted");
  assert.equal(result.evidence.commands[0].status, "failed");
});

test("timeouts are deterministic even when handlers ignore AbortSignal", async () => {
  const registry = createToolRegistry();
  registry.register(createFunctionTool({
    toolId: "tool_ignore_abort",
    label: "Ignore abort",
    risk: "read",
    requiredScopes: ["repo:read"],
    timeoutMs: 1,
    handler() {
      return new Promise((resolve) => {
        setTimeout(() => resolve({ ok: true }), 50);
      });
    },
  }));
  const gateway = createToolGateway({ now, registry });

  const result = await gateway.execute({
    runId: "run_tool_gateway",
    toolId: "tool_ignore_abort",
    actor: actor(["repo:read"]),
    projectId: "proj_jami_harness",
    environment: "local",
    input: { query: "status" },
  });

  assert.equal(result.executable, false);
  assert.equal(result.status, "timeout");
  assert.equal(result.execution.error.code, "timeout");
  assert.equal(result.trace.attributes.result, undefined);
  assert.equal(result.execution.redaction.resultPolicy, "omitted");
});

test("policy engine failures fail closed without invoking handlers", async () => {
  let invoked = 0;
  const registry = createToolRegistry();
  registry.register(createFunctionTool({
    toolId: "tool_policy_failure",
    label: "Policy failure",
    risk: "read",
    requiredScopes: ["repo:read"],
    handler() {
      invoked += 1;
      return { ok: true };
    },
  }));
  const gateway = createToolGateway({
    now,
    registry,
    policyEngine: {
      evaluate() {
        throw new Error("policy backend unavailable apiKey=policy-secret");
      },
    },
  });

  const result = await gateway.execute({
    runId: "run_tool_gateway",
    toolId: "tool_policy_failure",
    actor: actor(["repo:read"]),
    projectId: "proj_jami_harness",
    environment: "local",
    input: { query: "status" },
  });

  assert.equal(invoked, 0);
  assert.equal(result.executable, false);
  assert.equal(result.status, "denied");
  assert.equal(result.execution.error.code, "policy_failed_closed");
  assert.equal(result.execution.error.message, "policy engine failed closed");
  assert.equal(result.policyDecision.reasons[0].includes("policy-secret"), false);
});

test("failed tool errors are redacted in traces and artifacts", async () => {
  const registry = createToolRegistry();
  registry.register(createFunctionTool({
    toolId: "tool_error_redaction",
    label: "Error redaction",
    risk: "read",
    requiredScopes: ["repo:read"],
    handler() {
      throw new Error("upstream rejected token=tool-secret Bearer abc123");
    },
  }));
  const gateway = createToolGateway({ now, registry });

  const result = await gateway.execute({
    runId: "run_tool_gateway",
    toolId: "tool_error_redaction",
    actor: actor(["repo:read"]),
    projectId: "proj_jami_harness",
    environment: "local",
    input: { query: "status" },
  });

  assert.equal(result.executable, false);
  assert.equal(result.status, "failed");
  assert.equal(result.execution.error.message.includes("tool-secret"), false);
  assert.equal(result.execution.error.message.includes("abc123"), false);
  assert.equal(result.trace.attributes.error.message, "upstream rejected token=[redacted] Bearer [redacted]");
  assert.equal(result.artifact.payload.error.message, "upstream rejected token=[redacted] Bearer [redacted]");
});
