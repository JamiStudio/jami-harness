import test from "node:test";
import assert from "node:assert/strict";
import { HarnessCoreError, composeHarnessCore } from "../src/index.mjs";

const now = () => new Date("2026-06-12T12:00:00.000Z");

test("composes default harness modules through core-owned ports", () => {
  const core = composeHarnessCore({ now });
  const inspection = core.inspect();

  assert.equal(core.schemaVersion, "2026-06-12.core-composition");
  assert.equal(inspection.boundaries.coreComposition, "package_owned_default_ports");
  assert.equal(inspection.modules.some((module) => module.name === "runtime" && module.available), true);
  assert.equal(inspection.modules.some((module) => module.name === "provider" && module.mode === "local_deterministic"), true);
  assert.equal(inspection.modules.some((module) => module.name === "checkpointStore" && module.mode === "memory"), true);
  assert.equal(inspection.installPaths.fullLocalHarness.evidenceCommands.includes("pnpm core:test"), true);
  assert.equal(core.tools.get("tool_local_echo").toolId, "tool_local_echo");
  assert.equal(core.toolAdapters.some((adapter) => adapter.adapterId === "adapter_openapi" && adapter.support === "unsupported"), true);
  assert.equal(core.sourceLocks.some((sourceLock) => sourceLock.adapterId === "adapter_mcp" && sourceLock.status === "locked"), true);
});

test("preserves explicit module injection and install path inspection", () => {
  const provider = {
    capabilities: { mode: "custom_provider", provider: true },
    async generate() {
      return { status: "completed", toolCalls: [] };
    },
  };
  const core = composeHarnessCore({ now, provider, disableMemory: true });
  const inspection = core.inspect();

  assert.equal(inspection.modules.find((module) => module.name === "provider").mode, "custom_provider");
  assert.equal(inspection.modules.find((module) => module.name === "memory").mode, "noop");
  assert.equal(inspection.modules.find((module) => module.name === "memory").available, false);
  assert.equal(inspection.installPaths.modularPaths.find((path) => path.pathId === "byo_provider").defaultMode, "custom_provider");
  assert.equal(inspection.installPaths.modularPaths.find((path) => path.pathId === "byo_memory").defaultMode, "noop");
});

test("fails closed when required core ports are malformed", () => {
  assert.throws(
    () => composeHarnessCore({ artifactStore: { capabilities: { mode: "custom" } } }),
    (error) => error instanceof HarnessCoreError && error.code === "invalid_module",
  );

  assert.throws(
    () => composeHarnessCore({ provider: { capabilities: { mode: "broken", provider: true } } }),
    (error) => error instanceof HarnessCoreError && error.code === "invalid_module",
  );
});
