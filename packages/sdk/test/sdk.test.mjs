import test from "node:test";
import assert from "node:assert/strict";
import { HarnessInputError, createHarness } from "../src/index.mjs";

const now = () => new Date("2026-06-09T12:00:00.000Z");

test("creates a local run with evidence, artifacts, traces, and inspectable modules", async () => {
  const harness = createHarness({ now });
  const result = await harness.run({
    runId: "run_sdk_fixture",
    sourceCommit: "d6cd77e",
    commands: [{ command: "node examples/local-evidence-run.mjs", status: "passed", recordedAt: "2026-06-09T12:00:00.000Z" }],
  });

  assert.equal(result.status, "completed");
  assert.equal(result.providerResult.status, "completed");
  assert.equal(result.providerResult.providerId, "provider_local_deterministic");
  assert.equal(result.toolExecutions.length, 1);
  assert.equal(result.toolExecutions[0].status, "completed");
  assert.equal(result.events.at(0).eventType, "run.started");
  assert.equal(result.evidence.source.commit, "d6cd77e");
  assert.equal(result.checkpoint.status, "completed");
  assert.match(result.checkpoint.replayHash, /^sha256:/);
  assert.equal(result.contextPack.runId, "run_sdk_fixture");
  assert.equal(result.metrics.some((metric) => metric.name === "run.latency_ms"), true);
  assert.equal(result.metrics.some((metric) => metric.name === "tokens.input_estimate" && metric.unit === "tokens"), true);
  assert.equal(result.metrics.some((metric) => metric.name === "cost.external_billable_usd" && metric.value === 0), true);
  assert.equal(result.metrics.some((metric) => metric.dimensions.tokenMeasurement === "character_count_estimate"), true);
  assert.equal(result.metrics.some((metric) => metric.dimensions.costBasis === "no_external_provider_billing"), true);
  assert.equal(result.metrics.some((metric) => metric.name === "tool.call.count" && metric.value === 1), true);
  assert.equal(result.evidence.artifacts.some((artifact) => artifact.artifactId.endsWith("_metrics")), true);
  assert.equal(harness.resume("run_sdk_fixture").reason, "run_completed");
  assert.equal(harness.readArtifact(result.artifact.artifactId).artifactId, result.artifact.artifactId);
  assert.equal(harness.readTraces().some((trace) => trace.name === "sdk.run"), true);
  assert.equal(harness.readMetrics().length, result.metrics.length);

  const inspection = harness.inspect();
  assert.equal(inspection.modules.some((module) => module.name === "runtime" && module.available), true);
  assert.equal(inspection.modules.some((module) => module.name === "checkpointStore" && module.available), true);
  assert.equal(inspection.modules.some((module) => module.name === "context" && module.available), true);
  assert.equal(inspection.modules.some((module) => module.name === "tools" && module.available), true);
  assert.equal(inspection.modules.some((module) => module.name === "provider" && module.available), true);
  assert.equal(inspection.boundaries.providerRuntime, "local_deterministic_only");
  assert.equal(inspection.boundaries.hostedProviders, "not_implemented");
  assert.equal(inspection.toolAdapters.some((adapter) => adapter.adapterId === "adapter_function" && adapter.support === "supported"), true);
  assert.equal(inspection.toolAdapters.some((adapter) => adapter.adapterId === "adapter_openapi" && adapter.sourceLock.status === "missing"), true);
  assert.equal(inspection.toolAdapterManifests.some((manifest) => manifest.capabilityId === "cap_shell_tool_gateway"), true);
  assert.equal(inspection.sourceLocks.some((sourceLock) => sourceLock.adapterId === "adapter_mcp" && sourceLock.status === "locked"), true);
  assert.equal(inspection.installPaths.fullLocalHarness.status, "supported_local_source_checkout");
  assert.equal(inspection.installPaths.fullLocalHarness.packageInstallStatus, "unavailable_private_manifests");
  assert.equal(inspection.installPaths.modularPaths.some((path) => path.pathId === "byo_memory" && path.status === "supported_port"), true);
  assert.equal(inspection.installPaths.modularPaths.some((path) => path.pathId === "byo_docs_output" && path.status === "repo_generator_supported_sdk_output_unavailable"), true);
  assert.equal(inspection.installPaths.unsupportedSurfaces.includes("Mintlify build/publish"), true);
});

test("external provider requests fail closed without hosted provider execution", async () => {
  const harness = createHarness({ now });
  const result = await harness.run({
    runId: "run_external_provider",
    providerId: "provider_openai",
    sourceCommit: "d6cd77e",
  });

  assert.equal(result.status, "unsupported");
  assert.equal(result.providerResult.status, "unsupported");
  assert.equal(result.providerResult.output.structured.failClosed, true);
  assert.equal(result.toolExecutions, undefined);
  assert.equal(result.checkpoint.status, "unsupported");
  assert.equal(result.evidence.commands[0].status, "failed");
  assert.equal(result.metrics.some((metric) => metric.name === "tool.call.count" && metric.value === 0), true);
  assert.equal(result.metrics.some((metric) => metric.name === "cost.external_billable_usd" && metric.value === 0), true);
  assert.equal(result.evidence.acceptedContracts.some((contract) => contract.name === "metricRecord"), true);
});

test("recoverable provider failure records checkpoint evidence and completes on retry", async () => {
  const harness = createHarness({ now });
  const result = await harness.run({
    runId: "run_provider_recovery",
    providerFailureMode: "fail_once",
    workflowId: "workflow_sdk_retry",
  });

  assert.equal(result.status, "completed");
  assert.equal(result.providerResult.status, "completed");
  assert.equal(result.toolExecutions[0].status, "completed");
  assert.equal(harness.readArtifacts().some((artifact) => artifact.title.includes("failed_recoverable")), true);
  assert.equal(result.checkpoint.status, "completed");
});

test("supports configurable module injection without changing run grammar", async () => {
  const writes = [];
  const checkpoints = [];
  const customMemory = {
    capabilities: { mode: "custom_memory", readable: true, writable: true, searchable: true },
    write(input) {
      writes.push(input);
      return { written: true, record: input };
    },
    search() {
      return { items: [], droppedItems: [] };
    },
    assembleContext() {
      return { items: [], droppedItems: [] };
    },
  };
  const customCheckpointStore = {
    capabilities: { mode: "custom_store", checkpoint: true, resume: true, approvals: true },
    writeCheckpoint(input) {
      checkpoints.push(input);
      return { written: true, checkpoint: { ...input, checkpointId: "chk_custom", replayHash: "sha256:custom" } };
    },
    readCheckpoint() {
      return undefined;
    },
    resume() {
      return { resumable: false, reason: "checkpoint_not_found" };
    },
    writeApproval(input) {
      return { written: true, approval: input };
    },
    listApprovals() {
      return [];
    },
  };
  const customProvider = {
    capabilities: { mode: "custom_provider", provider: true },
    async generate(input) {
      return {
        schemaVersion: "2026-06-09",
        providerRunId: "prv_custom",
        runId: input.runId,
        providerId: "provider_custom",
        status: "completed",
        reason: "custom provider",
        generatedAt: "2026-06-09T12:00:00.000Z",
        output: { text: "custom", structured: {} },
        toolCalls: [],
        evidenceRef: "ev_custom_provider",
        traceName: "provider.completed",
        redaction: { privatePayloadPolicy: "none", redactedFields: [] },
        retryable: false,
        executable: true,
      };
    },
  };

  const harness = createHarness({ now, memory: customMemory, checkpointStore: customCheckpointStore, provider: customProvider });
  const result = await harness.run({ runId: "run_custom_memory" });

  assert.equal(result.runId, "run_custom_memory");
  assert.equal(harness.inspect().modules.find((module) => module.name === "memory").mode, "custom_memory");
  assert.equal(harness.inspect().modules.find((module) => module.name === "checkpointStore").mode, "custom_store");
  assert.equal(harness.inspect().modules.find((module) => module.name === "provider").mode, "custom_provider");
  assert.equal(harness.inspect().installPaths.modularPaths.find((path) => path.pathId === "byo_memory").defaultMode, "custom_memory");
  assert.equal(harness.inspect().installPaths.modularPaths.find((path) => path.pathId === "byo_provider").defaultMode, "custom_provider");
  assert.deepEqual(writes, []);
  assert.equal(checkpoints.length, 1);
});

test("rejects malformed run and evidence identifiers before writing artifacts", async () => {
  const harness = createHarness({ now });

  await assert.rejects(
    () => harness.run({ runId: "not-a-run-id" }),
    (error) => error instanceof HarnessInputError && error.code === "invalid_identifier",
  );

  await assert.rejects(
    () => harness.run({ runId: null }),
    (error) => error instanceof HarnessInputError && error.code === "invalid_identifier",
  );

  await assert.rejects(
    () => harness.run({ runId: "run_bad_artifact", artifactId: "report" }),
    (error) => error instanceof HarnessInputError && error.code === "invalid_identifier",
  );

  await assert.rejects(
    () => harness.run({ runId: "run_bad_evidence", evidenceRef: "evidence" }),
    (error) => error instanceof HarnessInputError && error.code === "invalid_identifier",
  );

  assert.equal(harness.readArtifacts().length, 0);
  assert.equal(harness.readTraces().length, 0);
});

test("rejects invalid injected core modules at construction", () => {
  assert.throws(
    () => createHarness({ artifactStore: { capabilities: { mode: "custom" } } }),
    (error) => error instanceof HarnessInputError && error.code === "invalid_module",
  );

  assert.throws(
    () => createHarness({ policyEngine: {} }),
    (error) => error instanceof HarnessInputError && error.code === "invalid_module",
  );

  assert.throws(
    () => createHarness({ checkpointStore: { capabilities: { mode: "broken" } } }),
    (error) => error instanceof HarnessInputError && error.code === "invalid_module",
  );
});
