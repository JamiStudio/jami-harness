import { createHash } from "node:crypto";
import { createInMemoryArtifactStore } from "@jami-studio/harness-artifacts";

const SCHEMA_VERSION = "2026-06-09";
const SENSITIVE_FIELD_PATTERN = /secret|apiKey|credential|password|privatePayload|plaintext|value|prompt|systemPrompt|developerPrompt|userPrompt|toolMetadata|tool_metadata|toolDescription|tool_description|toolSchema|tool_schema/i;
const SENSITIVE_TOKEN_FIELD_PATTERN = /^token$|^token(value|secret|credential|key|payload|plaintext)$|[a-z0-9_-]*token$/i;
const RUN_ID_PATTERN = /^run_[a-z0-9][a-z0-9_-]*$/;
const METRIC_NAME_PATTERN = /^[a-z][a-z0-9_.-]*$/;
const METRIC_KINDS = new Set(["latency", "tokens", "cost", "tool_call", "run", "provider", "custom"]);
const METRIC_UNITS = new Set(["ms", "tokens", "usd", "count", "ratio"]);
const METRIC_SOURCE_REF_PATTERNS = {
  eventRef: /^evt_[a-z0-9][a-z0-9_-]*$/,
  traceRef: /^trc_[a-z0-9][a-z0-9_-]*$/,
  auditRef: /^aud_[a-z0-9][a-z0-9_-]*$/,
  artifactRef: /^art_[a-z0-9][a-z0-9_-]*$/,
  toolExecutionRef: /^tex_[a-z0-9][a-z0-9_-]*$/,
  providerRunRef: /^prv_[a-z0-9][a-z0-9_-]*$/,
  checkpointRef: /^chk_[a-z0-9][a-z0-9_-]*$/,
};

export function createRunObservability(options = {}) {
  const now = options.now ?? (() => new Date());
  const artifactStore = options.artifactStore ?? createInMemoryArtifactStore({ now });
  const events = [];
  const audits = [];
  const traces = [];
  const metrics = [];

  function recordMetric(name, input = {}) {
    const metric = normalizeMetricRecord({ ...input, name }, { now, index: metrics.length });
    metrics.push(metric);
    return metric;
  }

  function recordUsageMetrics(input = {}) {
    const recorded = [];
    if (input.latencyMs !== undefined) {
      recorded.push(recordMetric(input.latencyName ?? "run.latency_ms", {
        ...input,
        kind: "latency",
        unit: "ms",
        value: input.latencyMs,
      }));
    }
    if (input.inputTokens !== undefined) {
      recorded.push(recordMetric(input.inputTokenName ?? "tokens.input", {
        ...input,
        kind: "tokens",
        unit: "tokens",
        value: input.inputTokens,
      }));
    }
    if (input.outputTokens !== undefined) {
      recorded.push(recordMetric(input.outputTokenName ?? "tokens.output", {
        ...input,
        kind: "tokens",
        unit: "tokens",
        value: input.outputTokens,
      }));
    }
    if (input.costUsd !== undefined) {
      recorded.push(recordMetric(input.costName ?? "cost.usd", {
        ...input,
        kind: "cost",
        unit: "usd",
        value: input.costUsd,
      }));
    }
    if (input.toolCallCount !== undefined) {
      recorded.push(recordMetric(input.toolCallName ?? "tool.call.count", {
        ...input,
        kind: "tool_call",
        unit: "count",
        value: input.toolCallCount,
      }));
    }
    return recorded;
  }

  return {
    capabilities: {
      mode: "memory",
      traces: true,
      audits: true,
      metrics: true,
      evidence: true,
      hosted: false,
      replacementPort: "harness.observability.sink",
    },
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
    metricSink: {
      write(metric) {
        metrics.push(normalizeMetricRecord(metric, { now, index: metrics.length }));
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
    recordMetric,
    recordUsageMetrics,
    exportEvidencePacket(input = {}) {
      const commandScans = (input.commands ?? []).map((command) => redactObject(command));
      const redactedCommands = commandScans.map((scan) => scan.value);
      const commandHadSecrets = commandScans.some((scan) => scan.paths.length > 0);
      const evidenceId = input.evidenceId ?? makeId("ev", input.runId, "evidence_packet");
      const metricRecords = [
        ...metrics,
        ...(input.metrics ?? []).map((metric, index) => normalizeMetricRecord(metric, { now, index: metrics.length + index })),
      ];
      if (metricRecords.length > 0) {
        artifactStore.write({
          artifactId: input.metricArtifactId ?? makeId("art", evidenceId, "metrics"),
          kind: "report",
          title: `Metric records for ${input.runId ?? "run_unknown"}`,
          runId: input.runId ?? "run_unknown",
          sourceRepo: input.repo ?? "jami-harness",
          sourceCommit: input.commit ?? "working-tree",
          sourceRef: input.ref ?? "refs/heads/main",
          evidenceRef: evidenceId,
          payload: metricArtifactPayload(metricRecords),
        });
      }
      const artifactRecords = [
        ...artifactStore.list(),
        ...(input.artifacts ?? []),
      ];
      const containsSecrets = commandHadSecrets || [...events, ...audits, ...traces, ...metricRecords, ...redactedCommands, ...artifactRecords].some((item) => {
        const scan = redactObject(item);
        return scan.paths.length > 0 || hasRedactionMarker(item) || item?.redaction?.privatePayloadPolicy === "omitted";
      });
      const packet = {
        schemaVersion: SCHEMA_VERSION,
        evidenceId,
        subject: input.subject ?? `Evidence packet for ${input.runId ?? "run_unknown"}`,
        freshnessClass: input.freshnessClass ?? "current_run",
        source: {
          repo: input.repo ?? "jami-harness",
          commit: input.commit ?? "working-tree",
          ref: input.ref ?? "refs/heads/main",
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
        acceptedContracts: input.acceptedContracts ?? [
          { name: "runEvent", version: SCHEMA_VERSION },
          { name: "auditEvent", version: SCHEMA_VERSION },
          { name: "traceEvent", version: SCHEMA_VERSION },
          { name: "metricRecord", version: SCHEMA_VERSION },
          { name: "artifactRecord", version: SCHEMA_VERSION },
          { name: "evidencePacket", version: SCHEMA_VERSION },
        ],
      };
      const artifact = artifactStore.write({
        artifactId: input.artifactId ?? `art_${evidenceId.replace(/^ev_/, "")}`,
        kind: "evidence",
        title: packet.subject,
        runId: input.runId ?? "run_unknown",
        sourceRepo: packet.source.repo,
        sourceCommit: packet.source.commit,
        sourceRef: packet.source.ref,
        evidenceRef: evidenceId,
        payload: packet,
      });
      return { packet, artifact, events: [...events], audits: [...audits], traces: [...traces], metrics: [...metricRecords] };
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
    get metrics() {
      return [...metrics];
    },
    artifactStore,
  };
}

export function normalizeMetricRecord(input = {}, options = {}) {
  const now = options.now ?? (() => new Date());
  const name = normalizeMetricName(input.name);
  const kind = normalizeMetricKind(input.kind, name, input.unit);
  const unit = normalizeMetricUnit(input.unit, kind);
  const value = Number(input.value ?? 0);
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError("metric value must be a finite number >= 0");
  }

  const dimensionScan = redactObject(input.dimensions ?? {});
  const sourceScan = normalizeMetricSource(input.source ?? {});
  const redactedFields = [
    ...dimensionScan.paths.map((path) => path.replace("$", "$.dimensions")),
    ...sourceScan.paths.map((path) => path.replace("$", "$.source")),
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    metricId: input.metricId ?? makeId("met", input.runId, name, options.index ?? 0),
    runId: normalizeRunId(input.runId),
    name,
    kind,
    value,
    unit,
    observedAt: input.observedAt ?? now().toISOString(),
    source: sourceScan.value,
    dimensions: dimensionScan.value,
    redaction: {
      payloadPolicy: redactedFields.length > 0 ? "redacted" : "none",
      redactedFields: [...new Set(redactedFields)],
    },
  };
}

function redactObject(value, path = "$") {
  const paths = [];
  const redacted = redactWalk(value, path, paths);
  return { value: redacted, paths };
}

function redactWalk(value, path, paths) {
  if (typeof value === "string") {
    const redacted = redactSecretLikeString(value);
    if (redacted !== value) paths.push(path);
    return redacted;
  }
  if (Array.isArray(value)) return value.map((child, index) => redactWalk(child, `${path}[${index}]`, paths));
  if (value === null || typeof value !== "object") return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (isSensitiveField(key)) {
      output[key] = "[redacted]";
      paths.push(childPath);
      continue;
    }
    output[key] = redactWalk(child, childPath, paths);
  }
  return output;
}

function redactSecretLikeString(value) {
  return value
    .replace(/\b(authorization)\b\s*[:=]\s*(?:[A-Za-z]+\s+)?[^,\s;]+/gi, "$1=[redacted]")
    .replace(/\b(api[_-]?key|token|secret|password|credential|authorization|cookie|session)\b\s*[:=]\s*[^,\s;]+/gi, "$1=[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]");
}

function isSensitiveField(key) {
  return SENSITIVE_FIELD_PATTERN.test(key) || SENSITIVE_TOKEN_FIELD_PATTERN.test(key);
}

function normalizeMetricSource(value) {
  const scan = redactObject(value);
  if (!scan.value || typeof scan.value !== "object" || Array.isArray(scan.value)) {
    return { value: undefined, paths: scan.paths };
  }

  const source = {};
  for (const [key, refValue] of Object.entries(scan.value)) {
    const pattern = METRIC_SOURCE_REF_PATTERNS[key];
    if (pattern && typeof refValue === "string" && pattern.test(refValue)) {
      source[key] = refValue;
    }
  }

  return {
    value: Object.keys(source).length > 0 ? source : undefined,
    paths: scan.paths,
  };
}

function metricArtifactPayload(metricRecords) {
  return {
    metricCount: metricRecords.length,
    metrics: metricRecords.map((metric) => ({
      metricId: metric.metricId,
      runId: metric.runId,
      name: metric.name,
      kind: metric.kind,
      measurement: metric.value,
      unit: metric.unit,
      observedAt: metric.observedAt,
      source: metric.source,
      redaction: metric.redaction,
    })),
  };
}

function hasRedactionMarker(value) {
  const serialized = JSON.stringify(value);
  return typeof serialized === "string" && serialized.includes("[redacted]");
}

function toEvidenceArtifactKind(kind) {
  if (["schema", "fixture", "generated_reference", "report", "log"].includes(kind)) return kind;
  return kind === "evidence" ? "report" : "log";
}

function normalizeRunId(value) {
  return typeof value === "string" && RUN_ID_PATTERN.test(value) ? value : "run_unknown";
}

function normalizeMetricName(value) {
  const normalized = String(value ?? "metric")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .replace(/_+$/g, "")
    .slice(0, 96);
  return METRIC_NAME_PATTERN.test(normalized) ? normalized : "metric.custom";
}

function normalizeMetricKind(kind, name, unit) {
  if (METRIC_KINDS.has(kind)) return kind;
  if (unit === "ms" || /latency|duration/.test(name)) return "latency";
  if (unit === "tokens" || /token/.test(name)) return "tokens";
  if (unit === "usd" || /cost|spend/.test(name)) return "cost";
  if (/tool/.test(name)) return "tool_call";
  return "custom";
}

function normalizeMetricUnit(unit, kind) {
  if (METRIC_UNITS.has(unit)) return unit;
  if (kind === "latency") return "ms";
  if (kind === "tokens") return "tokens";
  if (kind === "cost") return "usd";
  if (kind === "tool_call") return "count";
  return "count";
}

function makeId(prefix, ...parts) {
  const body = parts
    .filter(Boolean)
    .join("_")
    .toLowerCase()
    .replace(/^(run|ev|trc|spn|met|art)_/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  if (body) return `${prefix}_${body}`;
  return `${prefix}_${createHash("sha256").update(String(Date.now())).digest("hex").slice(0, 12)}`;
}
