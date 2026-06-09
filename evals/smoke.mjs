#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createContextAssembler,
  createInMemoryMemoryPort,
  createMemorySearchAdapter,
} from "../packages/memory/src/index.mjs";
import { createHarness } from "../packages/sdk/src/index.mjs";
import {
  createFunctionTool,
  createToolGateway,
  createToolRegistry,
  dryRunUnsupportedAdapter,
} from "../packages/tools/src/index.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const now = () => new Date("2026-06-09T12:00:00.000Z");
const scenarios = [];

await scenario("tool_safety", async () => {
  let invoked = 0;
  const registry = createToolRegistry();
  registry.register(createFunctionTool({
    toolId: "tool_eval_write",
    label: "Eval write fixture",
    risk: "write",
    requiredScopes: ["tool:eval:write"],
    handler() {
      invoked += 1;
      return { ok: true };
    },
  }));
  const gateway = createToolGateway({ now, registry });
  const denied = await gateway.execute({
    runId: "run_eval_tool_safety",
    toolId: "tool_eval_write",
    actor: { actorId: "actor_developer", scopes: ["repo:read"] },
    projectId: "proj_jami_harness",
    environment: "local",
    input: { token: "do-not-export" },
  });
  const unsupported = await dryRunUnsupportedAdapter({
    adapterId: "adapter_shell",
    now,
    actor: { actorId: "actor_developer", scopes: ["repo:read"] },
  });

  assert.equal(invoked, 0);
  assert.equal(denied.status, "denied");
  assert.equal(denied.auditEvent.eventType, "tool.denied");
  assert.equal(denied.trace.attributes.input.token, "[redacted]");
  assert.equal(unsupported.status, "unsupported");
  assert.equal(unsupported.execution.error.code, "adapter_unsupported");
  assert.equal(gateway.observability.metrics.some((metric) => metric.dimensions.status === "denied"), true);

  return {
    deniedStatus: denied.status,
    unsupportedStatus: unsupported.status,
    metricCount: gateway.observability.metrics.length,
  };
});

await scenario("docs_generation", () => {
  const result = spawnSync(process.execPath, ["packages/docs/scripts/generate-docs.mjs", "--check"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, (result.stderr || result.stdout || "docs generation check failed").trim());
  return {
    command: "node packages/docs/scripts/generate-docs.mjs --check",
    status: "passed",
  };
});

await scenario("memory_recall", () => {
  const memory = createInMemoryMemoryPort({ now });
  memory.write({
    memoryId: "mem_eval_allowed",
    kind: "project",
    projectId: "proj_jami_harness",
    runId: "run_eval_memory",
    summary: "Docs evidence should stay local and cited.",
    content: "Local evidence packets are generated from accepted source records.",
    scope: { projectId: "proj_jami_harness", allowedActorIds: ["actor_developer"], allowedScopes: ["memory:read"] },
  });
  memory.write({
    memoryId: "mem_eval_other_actor",
    kind: "project",
    projectId: "proj_jami_harness",
    runId: "run_eval_memory",
    summary: "Do not recall",
    content: "This belongs to a different actor.",
    scope: { projectId: "proj_jami_harness", allowedActorIds: ["actor_owner"], allowedScopes: ["memory:read"] },
  });
  memory.write({
    memoryId: "mem_eval_secret",
    kind: "project",
    projectId: "proj_jami_harness",
    runId: "run_eval_memory",
    summary: "token fixture",
    content: "token=do-not-recall",
    tokenValue: "must-not-export",
    scope: { projectId: "proj_jami_harness", allowedActorIds: ["actor_developer"], allowedScopes: ["memory:read"] },
  });

  const assembler = createContextAssembler({
    search: createMemorySearchAdapter(memory),
    tokenBudget: 120,
  });
  const pack = assembler.assemble({
    runId: "run_eval_memory",
    projectId: "proj_jami_harness",
    actor: { actorId: "actor_developer", scopes: ["memory:read"] },
  });

  assert.equal(pack.items.some((item) => item.sourceRef === "mem_eval_allowed"), true);
  assert.equal(pack.droppedItems.some((item) => item.sourceRef === "mem_eval_other_actor" && item.reason === "permission_denied"), true);
  assert.equal(memory.list().find((record) => record.memoryId === "mem_eval_secret").content, undefined);
  assert.equal(JSON.stringify(pack).includes("do-not-recall"), false);

  return {
    includedItems: pack.items.length,
    droppedItems: pack.droppedItems.length,
    replayHash: pack.deterministicHash,
  };
});

await scenario("recovery", async () => {
  const harness = createHarness({ now });
  const result = await harness.run({
    runId: "run_eval_recovery",
    providerFailureMode: "fail_once",
    workflowId: "workflow_eval_recovery",
  });

  assert.equal(result.status, "completed");
  assert.equal(result.providerResult.status, "completed");
  assert.equal(result.toolExecutions[0].status, "completed");
  assert.equal(harness.readArtifacts().some((artifact) => artifact.title.includes("failed_recoverable")), true);
  assert.equal(result.metrics.some((metric) => metric.name === "tool.call.count" && metric.value >= 1), true);
  assert.equal(result.metrics.some((metric) => metric.name === "cost.external_billable_usd" && metric.value === 0), true);
  assert.equal(result.metrics.some((metric) => metric.name === "tokens.input_estimate"), true);

  return {
    status: result.status,
    checkpointStatus: result.checkpoint.status,
    metricCount: result.metrics.length,
  };
});

const failed = scenarios.filter((item) => item.status !== "passed");
const report = {
  schemaVersion: "2026-06-09.eval-smoke",
  command: "eval:smoke",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: now().toISOString(),
  scenarios,
  backend: "local_deterministic",
  unavailable: [
    "hosted observability backend",
    "external eval backend",
    "LLM judge",
  ],
};

console.log(JSON.stringify(report, null, 2));
if (failed.length > 0) process.exit(1);

async function scenario(name, fn) {
  try {
    const evidence = await fn();
    scenarios.push({ name, status: "passed", evidence });
  } catch (error) {
    scenarios.push({
      name,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
