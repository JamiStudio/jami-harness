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
  assert.equal(result.events.at(0).eventType, "run.started");
  assert.equal(result.evidence.source.commit, "d6cd77e");
  assert.equal(result.checkpoint.status, "completed");
  assert.match(result.checkpoint.replayHash, /^sha256:/);
  assert.equal(result.contextPack.runId, "run_sdk_fixture");
  assert.equal(harness.resume("run_sdk_fixture").reason, "run_completed");
  assert.equal(harness.readArtifact(result.artifact.artifactId).artifactId, result.artifact.artifactId);
  assert.equal(harness.readTraces()[0].name, "sdk.run");

  const inspection = harness.inspect();
  assert.equal(inspection.modules.some((module) => module.name === "runtime" && module.available), true);
  assert.equal(inspection.modules.some((module) => module.name === "checkpointStore" && module.available), true);
  assert.equal(inspection.modules.some((module) => module.name === "context" && module.available), true);
  assert.equal(inspection.modules.some((module) => module.name === "tools" && module.available), true);
  assert.equal(inspection.boundaries.toolGateway, "foundation_only");
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

  const harness = createHarness({ now, memory: customMemory, checkpointStore: customCheckpointStore });
  const result = await harness.run({ runId: "run_custom_memory" });

  assert.equal(result.runId, "run_custom_memory");
  assert.equal(harness.inspect().modules.find((module) => module.name === "memory").mode, "custom_memory");
  assert.equal(harness.inspect().modules.find((module) => module.name === "checkpointStore").mode, "custom_store");
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
