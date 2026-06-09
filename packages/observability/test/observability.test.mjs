import test from "node:test";
import assert from "node:assert/strict";
import { createRunLifecycleKernel } from "../../runtime/src/index.mjs";
import { createRunObservability } from "../src/index.mjs";

const now = () => new Date("2026-06-09T12:00:00.000Z");

test("exports an evidence packet from runtime events, audit events, traces, and artifacts", async () => {
  const observability = createRunObservability({ now });
  const kernel = createRunLifecycleKernel({
    now,
    runId: "run_stream4_foundation",
    actor: { actorId: "actor_developer", scopes: ["repo:read"] },
    projectId: "proj_jami_harness",
    environment: "local",
    eventSink: observability.eventSink,
    auditSink: observability.auditSink,
  });

  kernel.start();
  kernel.progress("collecting evidence");
  observability.trace("run.progress", {
    runId: "run_stream4_foundation",
    kind: "run",
    status: "ok",
    attributes: {
      prompt: "redacted by default",
      token: "do-not-export",
      toolMetadata: { description: "private tool metadata" },
    },
  });
  const packet = observability.exportEvidencePacket({
    runId: "run_stream4_foundation",
    subject: "Stream 4 run evidence",
    commands: [{ command: "pnpm runtime:test", status: "passed", recordedAt: "2026-06-09T12:00:00.000Z" }],
  });

  assert.equal(packet.packet.evidenceId, "ev_stream4_foundation_evidence_packet");
  assert.equal(packet.packet.source.ref, "refs/heads/main");
  assert.deepEqual(packet.packet.acceptedContracts[0], { name: "runEvent", version: "2026-06-09" });
  assert.equal(packet.packet.redaction.containsSecrets, true);
  assert.equal(packet.traces[0].attributes.prompt, "[redacted]");
  assert.equal(packet.traces[0].attributes.token, "[redacted]");
  assert.equal(packet.traces[0].attributes.toolMetadata, "[redacted]");
  assert.equal(packet.artifact.kind, "evidence");
});

test("observability sinks keep runtime events displayable without executing UI or tools", () => {
  const observability = createRunObservability({ now });
  observability.eventSink.write({
    schemaVersion: "2026-06-09",
    eventId: "evt_stream4_0",
    runId: "run_stream4_foundation",
    sequence: 0,
    occurredAt: "2026-06-09T12:00:00.000Z",
    eventType: "ui.payload.emitted",
    uiPayloadRef: "uip_stream4_summary",
    rendererState: "not_requested",
    privatePayload: "withheld",
  });

  assert.equal(observability.events[0].privatePayload, "[redacted]");
});

test("records redacted local usage metrics and exports metric evidence artifacts", () => {
  const observability = createRunObservability({ now });

  observability.recordUsageMetrics({
    runId: "run_stream4_foundation",
    latencyMs: 25,
    inputTokens: 12,
    outputTokens: 18,
    costUsd: 0,
    toolCallCount: 2,
    dimensions: {
      providerId: "provider_local_deterministic",
      apiKey: "must-not-export",
    },
  });
  observability.metricSink.write({
    runId: "run_stream4_foundation",
    name: "tool.latency_ms",
    kind: "latency",
    value: 9,
    unit: "ms",
    dimensions: {
      toolId: "tool_local_echo",
      token: "must-not-export",
    },
  });

  assert.equal(observability.metrics.length, 6);
  assert.equal(observability.metrics[0].name, "run.latency_ms");
  assert.equal(observability.metrics[1].unit, "tokens");
  assert.equal(observability.metrics[3].name, "cost.usd");
  assert.equal(observability.metrics[5].dimensions.token, "[redacted]");
  assert.deepEqual(observability.metrics[5].redaction.redactedFields, ["$.dimensions.token"]);

  const evidence = observability.exportEvidencePacket({
    runId: "run_stream4_foundation",
    evidenceId: "ev_stream4_metrics",
    subject: "Stream 4 metrics evidence",
  });
  const metricArtifact = evidence.packet.artifacts.find((artifact) => artifact.artifactId === "art_stream4_metrics_metrics");
  const metricArtifactRecord = observability.artifactStore.read(metricArtifact.artifactId);
  const metricArtifactPayload = observability.artifactStore.readPayload(metricArtifact.artifactId);

  assert.equal(evidence.metrics.length, 6);
  assert.equal(metricArtifact.kind, "report");
  assert.equal(metricArtifactRecord.redaction.privatePayloadPolicy, "redacted");
  assert.equal(metricArtifactPayload.metrics[0].measurement, 25);
  assert.equal(evidence.packet.acceptedContracts.some((contract) => contract.name === "metricRecord"), true);
  assert.equal(evidence.packet.redaction.containsSecrets, true);
});

test("redacts secret-looking strings and keeps metric source records schema-shaped", () => {
  const observability = createRunObservability({ now });

  const trace = observability.trace("run.message", {
    runId: "run_stream4_foundation",
    attributes: {
      message: "provider returned token=trace-secret Bearer abc123",
    },
  });
  const metric = observability.recordMetric("provider.latency_ms", {
    runId: "run_stream4_foundation",
    kind: "latency",
    value: 11,
    unit: "ms",
    source: {
      traceRef: "trc_stream4_foundation",
      requestId: "req_should_not_enter_metric_source",
      token: "source-secret",
    },
    dimensions: {
      note: "apiKey=dimension-secret",
    },
  });
  const evidence = observability.exportEvidencePacket({
    runId: "run_stream4_foundation",
    evidenceId: "ev_stream4_string_redaction",
    commands: [{
      command: "curl -H Authorization: Bearer command-secret https://example.invalid",
      status: "failed",
      recordedAt: "2026-06-09T12:00:00.000Z",
    }],
  });

  assert.equal(trace.attributes.message, "provider returned token=[redacted] Bearer [redacted]");
  assert.deepEqual(trace.redaction.redactedFields, ["$.message"]);
  assert.deepEqual(metric.source, { traceRef: "trc_stream4_foundation" });
  assert.equal(metric.dimensions.note, "apiKey=[redacted]");
  assert.equal(metric.redaction.redactedFields.includes("$.dimensions.note"), true);
  assert.equal(metric.redaction.redactedFields.includes("$.source.token"), true);
  assert.equal(evidence.packet.commands[0].command.includes("command-secret"), false);
  assert.equal(evidence.packet.redaction.containsSecrets, true);
});
