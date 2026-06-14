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
  assert.equal(inspection.modules.some((module) => module.name === "provider" && module.mode === "provider_router_local_plus_hosted"), true);
  assert.equal(inspection.boundaries.hostedProviders, "fail_closed_openai_adapter_available");
  assert.equal(inspection.modules.some((module) => module.name === "checkpointStore" && module.mode === "memory"), true);
  assert.equal(inspection.installPaths.fullLocalHarness.evidenceCommands.includes("pnpm core:test"), true);
  assert.equal(inspection.installPaths.fullLocalHarness.packageInstallStatus, "public_npm_install_smoke_passed");
  assert.equal(inspection.installPaths.unsupportedSurfaces.includes("public npm install"), false);
  assert.equal(inspection.installPaths.unsupportedSurfaces.includes("release attestations"), false);
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

test("telemetry is OFF by default and the vendor sink is never composed", () => {
  // Explicit empty-ish env so the test does not depend on the host environment.
  const core = composeHarnessCore({ now, env: { JAMI_TELEMETRY: undefined } });
  const inspection = core.inspect();

  assert.equal(core.telemetry.enabled, false);
  assert.equal(inspection.telemetry.enabled, false);
  assert.equal(inspection.boundaries.telemetry, "off_by_default");
  // The default observability port carries no telemetry capability when disabled.
  assert.equal(core.observability.capabilities?.telemetry ?? "disabled", "disabled");
  assert.equal(core.observability.telemetry, undefined);
});

test("telemetry stays OFF in CI even when the opt-in flag and key are set", () => {
  const core = composeHarnessCore({
    now,
    env: { JAMI_TELEMETRY: "1", CI: "true", POSTHOG_KEY: "phc_test" },
  });
  assert.equal(core.telemetry.enabled, false);
  assert.equal(core.telemetry.reason, "disabled_ci_environment");
});

test("telemetry composes the sink only when the gate is enabled", async () => {
  const captured = { summaries: [], shutdowns: 0 };
  const telemetrySink = {
    kind: "fake-sink",
    captureRunEvent() {},
    captureTrace() {},
    captureMetrics() {},
    captureRunSummary: (summary) => captured.summaries.push(summary),
    async shutdown() {
      captured.shutdowns += 1;
    },
  };
  const core = composeHarnessCore({
    now,
    env: { JAMI_TELEMETRY: "1", POSTHOG_KEY: "phc_test", POSTHOG_HOST: "https://us.posthog.com" },
    telemetrySink,
  });
  const inspection = core.inspect();

  assert.equal(core.telemetry.enabled, true);
  assert.equal(inspection.telemetry.enabled, true);
  assert.equal(inspection.telemetry.sink, "fake-sink");
  assert.equal(inspection.boundaries.telemetry, "oss_safe_opt_in_enabled");
  assert.equal(core.observability.capabilities.telemetry, "fake-sink");

  // A run summary tees to the sink and shutdown flushes it.
  core.observability.exportEvidencePacket({ runId: "run_demo", subject: "demo" });
  assert.equal(captured.summaries.length, 1);
  await core.shutdownTelemetry();
  assert.equal(captured.shutdowns, 1);
});

test("disableTelemetry option forces telemetry off regardless of env", () => {
  const core = composeHarnessCore({
    now,
    disableTelemetry: true,
    env: { JAMI_TELEMETRY: "1", POSTHOG_KEY: "phc_test" },
  });
  assert.equal(core.telemetry.enabled, false);
  assert.equal(core.telemetry.reason, "disabled_by_option");
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

test("fails closed when injected adapter source-lock inspection hides unsupported states", () => {
  const defaults = composeHarnessCore({ now }).sourceLocks;

  assert.throws(
    () => composeHarnessCore({
      now,
      sourceLocks: defaults.map((sourceLock) =>
        sourceLock.adapterId === "adapter_openapi"
          ? { ...sourceLock, status: "locked" }
          : sourceLock,
      ),
    }),
    (error) => error instanceof HarnessCoreError && error.code === "invalid_source_lock",
  );

  assert.throws(
    () => composeHarnessCore({
      now,
      sourceLocks: defaults.filter((sourceLock) => sourceLock.adapterId !== "adapter_shell"),
    }),
    (error) => error instanceof HarnessCoreError && error.code === "invalid_source_lock",
  );
});
