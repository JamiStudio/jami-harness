import { createHash } from "node:crypto";

const SCHEMA_VERSION = "2026-06-09";
const SECRET_FIELD_PATTERN = /secret|token|apiKey|credential|password|privatePayload|plaintext|value/i;

export function createInMemoryArtifactStore(options = {}) {
  const now = options.now ?? (() => new Date());
  const records = new Map();
  const payloads = new Map();

  return {
    capabilities: {
      mode: "memory",
      durable: false,
      supportsPromotion: true,
      supportsPrivatePayloads: false,
    },

    write(input) {
      const prepared = prepareArtifactRecord(input, { now });
      records.set(prepared.record.artifactId, prepared.record);
      payloads.set(prepared.record.artifactId, prepared.payload);
      return prepared.record;
    },

    read(artifactId) {
      return records.get(artifactId);
    },

    readPayload(artifactId) {
      return payloads.get(artifactId);
    },

    promote(artifactId, promotionState) {
      const record = records.get(artifactId);
      if (!record) return undefined;
      const next = { ...record, promotionState };
      records.set(artifactId, next);
      return next;
    },

    list() {
      return [...records.values()];
    },
  };
}

export function prepareArtifactRecord(input, options = {}) {
  const now = options.now ?? (() => new Date());
  const payloadScan = scanSensitive(input.payload);
  const artifactId = input.artifactId ?? makeId("art", input.runId, input.kind ?? "artifact");
  const classification = input.redaction?.classification ?? (payloadScan.hasSensitive ? "secret_adjacent" : "internal");
  const privatePayloadPolicy = input.redaction?.privatePayloadPolicy ?? (payloadScan.hasSensitive ? "omitted" : "redacted");
  const payload = payloadScan.hasSensitive ? undefined : input.payload;
  const contentHash = hashStable(payload ?? { redacted: true, artifactId });

  return {
    record: {
      schemaVersion: SCHEMA_VERSION,
      artifactId,
      kind: input.kind ?? "report",
      title: input.title,
      promotionState: input.promotionState ?? "draft",
      provenance: {
        runId: input.runId ?? "run_unknown",
        sourceRepo: input.sourceRepo ?? "jami-harness",
        sourceCommit: input.sourceCommit ?? "working-tree",
        sourceRef: input.sourceRef ?? "refs/heads/main",
        evidenceRef: input.evidenceRef ?? makeId("ev", input.runId, artifactId),
        createdAt: now().toISOString(),
        commandRef: input.commandRef,
        traceRef: input.traceRef,
        auditRefs: input.auditRefs ?? [],
      },
      storage: {
        mode: input.storageMode ?? "memory",
        locator: input.locator ?? `memory://${artifactId}`,
        contentHash,
      },
      redaction: {
        classification,
        privatePayloadPolicy,
        redactedFields: [...payloadScan.paths],
      },
    },
    payload,
  };
}

export function toArtifactView(record, renderers = [{ rendererId: "renderer_json", mode: "json" }]) {
  return {
    schemaVersion: SCHEMA_VERSION,
    artifactViewId: record.artifactViewId ?? `artv_${record.artifactId.replace(/^art_/, "")}`,
    artifactId: record.artifactId,
    kind: record.kind === "memory_snapshot" || record.kind === "context_pack" ? "report" : record.kind,
    title: record.title,
    promotionState: record.promotionState,
    renderers,
    provenance: {
      runId: record.provenance.runId,
      sourceRepo: record.provenance.sourceRepo,
      sourceCommit: record.provenance.sourceCommit,
      sourceRef: record.provenance.sourceRef,
      evidenceRef: record.provenance.evidenceRef,
    },
  };
}

function scanSensitive(value, path = "$") {
  const paths = [];
  walk(value, path, paths);
  return { hasSensitive: paths.length > 0, paths };
}

function walk(value, path, paths) {
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (SECRET_FIELD_PATTERN.test(key)) {
      paths.push(childPath);
      continue;
    }
    walk(child, childPath, paths);
  }
}

function hashStable(value) {
  return `sha256:${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function stableStringify(value) {
  return JSON.stringify(sortObject(value));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}

function makeId(prefix, ...parts) {
  const body = parts
    .filter(Boolean)
    .join("_")
    .toLowerCase()
    .replace(/^(run|art|ev)_/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  return `${prefix}_${body || "record"}`;
}
