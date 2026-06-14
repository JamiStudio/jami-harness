import assert from "node:assert/strict";
import test from "node:test";

import {
  HARNESS_PACKAGE,
  composeHarnessCore,
  createHarness,
  createInMemoryCheckpointStore,
  createToolRegistry,
} from "../src/index.mjs";

test("canonical harness package exports the current batteries-included local entrypoints", async () => {
  assert.equal(HARNESS_PACKAGE.name, "@jami-studio/harness");
  assert.equal(HARNESS_PACKAGE.hostedRuntimeIncluded, false);

  const harness = createHarness();
  const inspection = harness.inspect();
  assert.ok(inspection.modules.some((module) => module.name === "runtime" && module.available));

  const result = await harness.run({ runId: "run_harness_package" });
  assert.equal(result.status, "completed");

  const core = composeHarnessCore();
  assert.equal(core.inspect().boundaries.providerRuntime, "provider_router_local_plus_hosted");
  assert.ok(createToolRegistry().capabilities().supportedAdapters.includes("adapter_function"));

  const store = createInMemoryCheckpointStore();
  store.writeCheckpoint({ runId: "run_harness_store", status: "checkpointed" });
  assert.equal(store.readCheckpoint("run_harness_store").runId, "run_harness_store");
});
