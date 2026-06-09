import test from "node:test";
import assert from "node:assert/strict";
import { createInMemoryArtifactStore, prepareArtifactRecord, toArtifactView } from "../src/index.mjs";

const now = () => new Date("2026-06-09T12:00:00.000Z");

test("stores artifact provenance through a replaceable memory storage port", () => {
  const store = createInMemoryArtifactStore({ now });
  const record = store.write({
    artifactId: "art_stream4_report",
    kind: "report",
    title: "Stream 4 report",
    runId: "run_stream4_foundation",
    sourceCommit: "working-tree",
    evidenceRef: "ev_stream4_foundation",
    payload: { status: "ok" },
  });

  assert.equal(record.storage.mode, "memory");
  assert.equal(record.provenance.runId, "run_stream4_foundation");
  assert.equal(record.provenance.sourceRepo, "jami-harness");
  assert.equal(record.provenance.sourceRef, "refs/heads/main");
  assert.equal(record.redaction.privatePayloadPolicy, "redacted");
  assert.equal(store.read("art_stream4_report").artifactId, "art_stream4_report");
});

test("omits secret-adjacent payloads from artifact storage by default", () => {
  const { record, payload } = prepareArtifactRecord({
    artifactId: "art_private_payload",
    kind: "evidence",
    runId: "run_stream4_foundation",
    evidenceRef: "ev_stream4_foundation",
    payload: { token: "do-not-store" },
  }, { now });

  assert.equal(payload, undefined);
  assert.equal(record.redaction.classification, "secret_adjacent");
  assert.equal(record.redaction.privatePayloadPolicy, "omitted");
  assert.deepEqual(record.redaction.redactedFields, ["$.token"]);
});

test("creates Studio UI displayable artifact views without exposing payload content", () => {
  const { record } = prepareArtifactRecord({
    artifactId: "art_trace_packet",
    kind: "trace",
    runId: "run_stream4_foundation",
    evidenceRef: "ev_stream4_foundation",
    payload: { events: 2 },
  }, { now });
  const view = toArtifactView(record);

  assert.equal(view.artifactViewId, "artv_trace_packet");
  assert.equal(view.provenance.sourceRepo, "jami-harness");
  assert.equal(view.provenance.sourceRef, "refs/heads/main");
  assert.equal(view.provenance.evidenceRef, "ev_stream4_foundation");
  assert.equal("payload" in view, false);
});
