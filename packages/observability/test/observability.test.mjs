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
    attributes: { prompt: "redacted by default", token: "do-not-export" },
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
  assert.equal(packet.traces[0].attributes.token, "[redacted]");
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
