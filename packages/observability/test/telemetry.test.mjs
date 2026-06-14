import test from "node:test";
import assert from "node:assert/strict";
import { createRunObservability } from "../src/index.mjs";
import {
  createNoopTelemetrySink,
  resolveTelemetryGate,
  withTelemetry,
} from "../src/telemetry.mjs";
import { createPostHogTelemetrySink } from "../src/posthog-sink.mjs";

const now = () => new Date("2026-06-14T12:00:00.000Z");

// A fake PostHog client capturing what would be sent — no network, no vendor import.
function createFakeClient() {
  return {
    events: [],
    exceptions: [],
    shutdownCalls: 0,
    capture(message) {
      this.events.push(message);
    },
    captureException(error, distinctId, properties) {
      this.exceptions.push({ error, distinctId, properties });
    },
    async shutdown() {
      this.shutdownCalls += 1;
    },
  };
}

test("gate is OFF by default with no telemetry env set", () => {
  const gate = resolveTelemetryGate({});
  assert.equal(gate.enabled, false);
  assert.equal(gate.reason, "disabled_opt_in_flag_unset");
});

test("gate honors DO_NOT_TRACK even when the opt-in flag and key are present", () => {
  const gate = resolveTelemetryGate({
    JAMI_TELEMETRY: "1",
    DO_NOT_TRACK: "1",
    POSTHOG_KEY: "phc_test",
    POSTHOG_HOST: "https://us.posthog.com",
  });
  assert.equal(gate.enabled, false);
  assert.equal(gate.reason, "disabled_do_not_track");
});

test("gate stays OFF in CI by default even with the opt-in flag set", () => {
  const gate = resolveTelemetryGate({
    JAMI_TELEMETRY: "true",
    CI: "true",
    POSTHOG_KEY: "phc_test",
  });
  assert.equal(gate.enabled, false);
  assert.equal(gate.reason, "disabled_ci_environment");
});

test("gate is OFF when the opt-in flag is set but no project key resolves", () => {
  const gate = resolveTelemetryGate({ JAMI_TELEMETRY: "1" });
  assert.equal(gate.enabled, false);
  assert.equal(gate.reason, "disabled_missing_project_key");
});

test("gate is ON only with opt-in flag, no DO_NOT_TRACK, not CI, and a key present", () => {
  const gate = resolveTelemetryGate({
    JAMI_TELEMETRY: "1",
    POSTHOG_KEY: "phc_test",
    POSTHOG_HOST: "https://us.posthog.com",
  });
  assert.equal(gate.enabled, true);
  assert.equal(gate.reason, "enabled");
  assert.equal(gate.key, "phc_test");
  assert.equal(gate.host, "https://us.posthog.com");
});

test("gate treats DO_NOT_TRACK=0 as not opting out", () => {
  const gate = resolveTelemetryGate({ JAMI_TELEMETRY: "1", DO_NOT_TRACK: "0", POSTHOG_KEY: "phc_test" });
  assert.equal(gate.enabled, true);
});

test("withTelemetry preserves the full observability surface and live getters", () => {
  const base = createRunObservability({ now });
  const wrapped = withTelemetry(base, createNoopTelemetrySink());

  assert.equal(typeof wrapped.trace, "function");
  assert.equal(typeof wrapped.recordMetric, "function");
  assert.equal(typeof wrapped.recordUsageMetrics, "function");
  assert.equal(typeof wrapped.exportEvidencePacket, "function");
  assert.equal(typeof wrapped.eventSink.write, "function");
  assert.equal(typeof wrapped.auditSink.write, "function");
  assert.equal(typeof wrapped.metricSink.write, "function");
  assert.ok(wrapped.artifactStore);

  // Live getters still reflect base state.
  wrapped.eventSink.write({ eventType: "run.started", runId: "run_demo", privatePayload: "x" });
  assert.equal(wrapped.events.length, 1);
  // Redaction from the base port is preserved through the wrapper.
  assert.equal(wrapped.events[0].privatePayload, "[redacted]");
});

test("withTelemetry tees run events, traces, metrics, and run summaries to the sink", () => {
  const base = createRunObservability({ now });
  const captured = { events: [], traces: [], metrics: [], summaries: [] };
  const sink = {
    kind: "fake",
    captureRunEvent: (event) => captured.events.push(event),
    captureTrace: (trace) => captured.traces.push(trace),
    captureMetrics: (metrics) => captured.metrics.push(...metrics),
    captureRunSummary: (summary) => captured.summaries.push(summary),
    async shutdown() {},
  };
  const observability = withTelemetry(base, sink);

  observability.eventSink.write({ eventType: "run.failed", runId: "run_demo", message: "boom" });
  observability.trace("provider.call", { runId: "run_demo", kind: "provider", status: "ok" });
  observability.recordUsageMetrics({ runId: "run_demo", latencyMs: 12, inputTokens: 5, outputTokens: 7, costUsd: 0 });
  observability.exportEvidencePacket({ runId: "run_demo", subject: "demo" });

  assert.equal(captured.events.length, 1);
  assert.equal(captured.traces.length, 1);
  assert.ok(captured.metrics.length >= 3);
  assert.equal(captured.summaries.length, 1);
  assert.equal(captured.summaries[0].runId, "run_demo");
});

test("withTelemetry never breaks a run when the sink throws", () => {
  const base = createRunObservability({ now });
  const throwingSink = {
    kind: "fake",
    captureRunEvent() {
      throw new Error("sink down");
    },
    captureTrace() {
      throw new Error("sink down");
    },
    captureMetrics() {
      throw new Error("sink down");
    },
    captureRunSummary() {
      throw new Error("sink down");
    },
    async shutdown() {
      throw new Error("sink down");
    },
  };
  const observability = withTelemetry(base, throwingSink);

  assert.doesNotThrow(() => {
    observability.eventSink.write({ eventType: "run.failed", runId: "run_demo", message: "boom" });
    observability.trace("provider.call", { runId: "run_demo", kind: "provider" });
    observability.recordUsageMetrics({ runId: "run_demo", latencyMs: 1 });
    observability.exportEvidencePacket({ runId: "run_demo" });
  });
  // Base data still recorded despite the failing sink.
  assert.equal(observability.events.length, 1);
  assert.ok(observability.traces.length >= 1);
});

test("PostHog sink maps a failure event to captureException with run-metadata only", async () => {
  const client = createFakeClient();
  const sink = createPostHogTelemetrySink({ key: "phc_test", client, distinctId: "install_token" });

  sink.captureRunEvent({ eventType: "run.failed", runId: "run_demo", taskId: "task_a", sequence: 3, message: "provider exploded" });
  await sink.ready();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(client.exceptions.length, 1);
  const exception = client.exceptions[0];
  assert.equal(exception.distinctId, "install_token");
  assert.equal(exception.properties.harness_run_id, "run_demo");
  assert.equal(exception.properties.$ai_trace_id, "trace_demo");
  // No prompt/response content fields are present.
  assert.equal("$ai_input" in exception.properties, false);
  assert.equal("$ai_output_choices" in exception.properties, false);
});

test("PostHog sink emits an $ai_generation run summary with usage but no content by default", async () => {
  const client = createFakeClient();
  const sink = createPostHogTelemetrySink({ key: "phc_test", client });

  sink.captureRunSummary({
    runId: "run_demo",
    evidenceId: "ev_demo",
    subject: "Local harness run",
    source: { repo: "jami-harness", ref: "refs/heads/main" },
    input: "SECRET PROMPT THAT MUST NOT LEAVE",
    output: "SECRET RESPONSE THAT MUST NOT LEAVE",
    traces: [{ kind: "provider", attributes: { providerId: "provider_local_deterministic" } }],
    metrics: [
      { kind: "latency", unit: "ms", value: 2500, name: "run.latency_ms" },
      { kind: "tokens", unit: "tokens", value: 10, name: "tokens.input_estimate", dimensions: { tokenMeasurement: "character_count_estimate" } },
      { kind: "tokens", unit: "tokens", value: 20, name: "tokens.output_estimate" },
      { kind: "cost", unit: "usd", value: 0, name: "cost.external_billable_usd" },
    ],
    events: [],
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(client.events.length, 1);
  const message = client.events[0];
  assert.equal(message.event, "$ai_generation");
  assert.equal(message.properties.$ai_trace_id, "trace_demo");
  assert.equal(message.properties.$ai_provider, "provider_local_deterministic");
  assert.equal(message.properties.$ai_latency, 2.5); // ms folded to seconds
  assert.equal(message.properties.$ai_input_tokens, 10);
  assert.equal(message.properties.$ai_output_tokens, 20);
  assert.equal(message.properties.$ai_total_cost_usd, 0);
  // The decisive privacy assertion: no prompt/response content is ever sent.
  const serialized = JSON.stringify(message);
  assert.equal(serialized.includes("SECRET PROMPT"), false);
  assert.equal(serialized.includes("SECRET RESPONSE"), false);
  assert.equal("$ai_input" in message.properties, false);
  assert.equal("$ai_output_choices" in message.properties, false);
});

test("PostHog sink maps a provider trace to an $ai_generation span event", async () => {
  const client = createFakeClient();
  const sink = createPostHogTelemetrySink({ key: "phc_test", client });

  sink.captureTrace({
    runId: "run_demo",
    spanId: "spn_1",
    name: "provider.generate",
    kind: "provider",
    status: "error",
    attributes: { providerId: "provider_local_deterministic", environment: "local", reason: "fail_once" },
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(client.events.length, 1);
  assert.equal(client.events[0].event, "$ai_generation");
  assert.equal(client.events[0].properties.$ai_is_error, true);
  assert.equal(client.events[0].properties.$ai_provider, "provider_local_deterministic");
});

test("PostHog sink shutdown flushes the underlying client", async () => {
  const client = createFakeClient();
  const sink = createPostHogTelemetrySink({ key: "phc_test", client });
  await sink.shutdown();
  assert.equal(client.shutdownCalls, 1);
});

test("PostHog sink stays inert when the vendor module cannot load", async () => {
  // No client injected and a failing loader: the sink must not throw and must no-op.
  const sink = createPostHogTelemetrySink({
    key: "phc_test",
    createClient: async () => {
      throw new Error("posthog-node not installed");
    },
  });
  assert.doesNotThrow(() => {
    sink.captureRunEvent({ eventType: "run.failed", runId: "run_demo", message: "boom" });
    sink.captureRunSummary({ runId: "run_demo", metrics: [] });
  });
  const client = await sink.ready();
  assert.equal(client, undefined);
  await sink.shutdown(); // must not throw
});
