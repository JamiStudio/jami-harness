import test from "node:test";
import assert from "node:assert/strict";
import {
  createDeterministicProvider,
  createUnsupportedExternalProvider,
  validateProviderRoute,
} from "../src/index.mjs";

const now = () => new Date("2026-06-09T12:00:00.000Z");

test("local deterministic provider emits tool-call workflow output without hosted provider claims", async () => {
  const provider = createDeterministicProvider({ now });
  const result = await provider.generate({
    runId: "run_provider_fixture",
    instruction: "produce evidence",
    contextHash: "sha256:context",
    memoryItemCount: 1,
  });

  assert.equal(result.status, "completed");
  assert.equal(result.providerId, "provider_local_deterministic");
  assert.equal(result.toolCalls[0].toolId, "tool_local_echo");
  assert.match(result.output.structured.replayHash, /^sha256:/);
  assert.equal(provider.manifest.features.find((feature) => feature.featureId === "hosted_models").support, "unsupported");
  assert.equal(provider.manifest.replacementCompatibility.portId, "harness.provider.model");
});

test("external provider routes fail closed as typed unsupported results", async () => {
  const provider = createUnsupportedExternalProvider("provider_openai", { now });
  const result = await provider.generate({ runId: "run_provider_external" });

  assert.equal(validateProviderRoute("provider_openai").status, "unsupported");
  assert.equal(result.status, "unsupported");
  assert.equal(result.executable, false);
  assert.equal(result.output.structured.failClosed, true);
  assert.equal(provider.manifest.features.find((feature) => feature.featureId === "hosted_provider_runtime").support, "unsupported");
});

test("fail-once mode preserves deterministic recovery semantics", async () => {
  const provider = createDeterministicProvider({ now });
  const first = await provider.generate({
    runId: "run_provider_retry",
    failureMode: "fail_once",
    workflowId: "workflow_retry",
  });
  const second = await provider.generate({
    runId: "run_provider_retry",
    failureMode: "fail_once",
    workflowId: "workflow_retry",
  });

  assert.equal(first.status, "failed_recoverable");
  assert.equal(first.retryable, true);
  assert.equal(second.status, "completed");
  assert.equal(second.toolCalls.length, 1);
});
