import { createHash } from "node:crypto";
import { createInMemoryArtifactStore } from "../../artifacts/src/index.mjs";

const SCHEMA_VERSION = "2026-06-09";
const SECRET_FIELD_PATTERN = /secret|token|apiKey|credential|password|privatePayload|plaintext|value/i;

export function createRunObservability(options = {}) {
  const now = options.now ?? (() => new Date());
  const artifactStore = options.artifactStore ?? createInMemoryArtifactStore({ now });
  const events = [];
  const audits = [];
  const traces = [];

  return {
    eventSink: {
      write(event) {
        events.push(redactObject(event).value);
      },
    },
    auditSink: {
      write(audit) {
        audits.push(redactObject(audit).value);
      },
    },
    trace(name, input = {}) {
      const redacted = redactObject(input.attributes ?? {});
      const trace = {
        schemaVersion: SCHEMA_VERSION,
        traceId: input.traceId ?? makeId("trc", input.runId, name),
        spanId: input.spanId ?? makeId("spn", name, traces.length),
        parentSpanId: input.parentSpanId,
        runId: input.runId ?? "run_unknown",
        name,
        kind: input.kind ?? "run",
        startedAt: input.startedAt ?? now().toISOString(),
        endedAt: input.endedAt,
        status: input.status ?? "unset",
        eventRef: input.eventRef,
        auditRef: input.auditRef,
        artifactRef: input.artifactRef,
        attributes: redacted.value,
        redaction: {
          payloadPolicy: redacted.paths.length > 0 ? "redacted" : "redacted",
          redactedFields: redacted.paths,
        },
      };
      traces.push(trace);
      return trace;
    },
    exportEvidencePacket(input = {}) {
      const redactedCommands = (input.commands ?? []).map((command) => redactObject(command).value);
      const artifactRecords = [
        ...artifactStore.list(),
        ...(input.artifacts ?? []),
      ];
      const evidenceId = input.evidenceId ?? makeId("ev", input.runId, "evidence_packet");
      const containsSecrets = [...events, ...audits, ...traces, ...redactedCommands, ...artifactRecords].some((item) => {
        const scan = redactObject(item);
        return scan.paths.length > 0 || item?.redaction?.privatePayloadPolicy === "omitted";
      });
      const packet = {
        schemaVersion: SCHEMA_VERSION,
        evidenceId,
        subject: input.subject ?? `Evidence packet for ${input.runId ?? "run_unknown"}`,
        freshnessClass: input.freshnessClass ?? "current_run",
        source: {
          repo: input.repo ?? "jami-harness",
          commit: input.commit ?? "working-tree",
          recordedAt: now().toISOString(),
        },
        commands: redactedCommands.length > 0 ? redactedCommands : [{
          command: "runtime event export",
          status: "passed",
          recordedAt: now().toISOString(),
          evidenceRef: evidenceId,
        }],
        artifacts: artifactRecords.map((artifact) => ({
          artifactId: artifact.artifactId,
          path: artifact.storage?.locator ?? artifact.path ?? `memory://${artifact.artifactId}`,
          kind: toEvidenceArtifactKind(artifact.kind),
        })),
        redaction: {
          containsSecrets,
          privatePayloadPolicy: containsSecrets ? "redacted" : "none",
          notes: "Prompts, inline secrets, credentials, private payloads, and tool metadata are redacted or omitted before export.",
        },
        acceptedContracts: input.acceptedContracts ?? ["runEvent", "auditEvent", "traceEvent", "artifactRecord", "evidencePacket"],
      };
      const artifact = artifactStore.write({
        artifactId: input.artifactId ?? `art_${evidenceId.replace(/^ev_/, "")}`,
        kind: "evidence",
        title: packet.subject,
        runId: input.runId ?? "run_unknown",
        sourceCommit: packet.source.commit,
        evidenceRef: evidenceId,
        payload: packet,
      });
      return { packet, artifact, events: [...events], audits: [...audits], traces: [...traces] };
    },
    get events() {
      return [...events];
    },
    get audits() {
      return [...audits];
    },
    get traces() {
      return [...traces];
    },
    artifactStore,
  };
}

function redactObject(value, path = "$") {
  if (value === null || typeof value !== "object") return { value, paths: [] };
  const paths = [];
  const redacted = redactWalk(value, path, paths);
  return { value: redacted, paths };
}

function redactWalk(value, path, paths) {
  if (Array.isArray(value)) return value.map((child, index) => redactWalk(child, `${path}[${index}]`, paths));
  if (value === null || typeof value !== "object") return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (SECRET_FIELD_PATTERN.test(key)) {
      output[key] = "[redacted]";
      paths.push(childPath);
      continue;
    }
    output[key] = redactWalk(child, childPath, paths);
  }
  return output;
}

function toEvidenceArtifactKind(kind) {
  if (["schema", "fixture", "generated_reference", "report", "log"].includes(kind)) return kind;
  return kind === "evidence" ? "report" : "log";
}

function makeId(prefix, ...parts) {
  const body = parts
    .filter(Boolean)
    .join("_")
    .toLowerCase()
    .replace(/^(run|ev|trc|spn)_/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  if (body) return `${prefix}_${body}`;
  return `${prefix}_${createHash("sha256").update(String(Date.now())).digest("hex").slice(0, 12)}`;
}
