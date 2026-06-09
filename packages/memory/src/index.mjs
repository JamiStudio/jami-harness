import { createHash } from "node:crypto";

const SCHEMA_VERSION = "2026-06-09";
const SECRET_FIELD_PATTERN = /secret|token|apiKey|credential|password|privatePayload|plaintext|value/i;

export function createNoopMemoryPort() {
  return {
    capabilities: { mode: "noop", readable: false, writable: false, searchable: false },
    write() {
      return { written: false, reason: "memory module disabled" };
    },
    search() {
      return { items: [], droppedItems: [] };
    },
    assembleContext(input = {}) {
      return createContextPack({ ...input, items: [], droppedItems: [] });
    },
  };
}

export function createNoopSearchAdapter() {
  return {
    capabilities: { mode: "noop_search", readable: false, searchable: false, hosted: false },
    search() {
      return { items: [], droppedItems: [], reason: "search adapter disabled" };
    },
  };
}

export function createMemorySearchAdapter(memory) {
  assertSearchableMemory(memory);
  return {
    capabilities: {
      mode: "memory_search",
      readable: memory.capabilities?.readable === true,
      searchable: memory.capabilities?.searchable === true,
      hosted: false,
    },
    search(query = {}) {
      return memory.search(query);
    },
  };
}

export function createContextAssembler(options = {}) {
  const search = options.search ?? createNoopSearchAdapter();
  const tokenBudget = options.tokenBudget ?? 1200;
  return {
    capabilities: {
      mode: options.mode ?? "default_context_assembler",
      replaceable: true,
      tokenBudget,
      replayable: true,
      citationPreserving: true,
    },
    assemble(input = {}) {
      const result = search.search(input);
      const ranked = (result.items ?? [])
        .map((item, index) => {
          const text = item.record?.summary ?? item.record?.content ?? "";
          const tokenEstimate = estimateTokens(text);
          return {
            sourceRef: item.record?.memoryId ?? item.sourceRef ?? `source_${index}`,
            kind: input.kind ?? "retrieved",
            priority: input.priorityBase ? input.priorityBase - index : 100 - index,
            inclusionReason: item.inclusionReason ?? "adapter returned item",
            citationId: item.citation?.citationId ?? item.record?.citation?.citationId,
            freshnessClass: item.citation?.freshnessClass ?? item.record?.citation?.freshnessClass ?? "unknown",
            tokenEstimate,
          };
        });
      const included = [];
      const droppedItems = [...(result.droppedItems ?? [])];
      let used = 0;
      for (const item of ranked) {
        if (used + item.tokenEstimate > tokenBudget) {
          droppedItems.push({ sourceRef: item.sourceRef, reason: "token_budget_exceeded" });
          continue;
        }
        included.push(item);
        used += item.tokenEstimate;
      }
      return createContextPack({
        runId: input.runId,
        now: input.now,
        items: included,
        droppedItems,
      });
    },
  };
}

export function createInMemoryMemoryPort(options = {}) {
  const now = options.now ?? (() => new Date());
  const records = new Map();

  return {
    capabilities: { mode: "memory", readable: true, writable: true, searchable: true },
    write(input) {
      const record = normalizeMemoryRecord(input, { now });
      records.set(record.memoryId, record);
      return { written: true, record };
    },
    search(query = {}) {
      const droppedItems = [];
      const nowDate = resolveNow(query.now, now);
      const items = [...records.values()]
        .filter((record) => {
          const allowed = canReadMemory(record, query.actor ?? {}, query.projectId);
          if (!allowed) droppedItems.push({ sourceRef: record.memoryId, reason: "permission_denied" });
          return allowed;
        })
        .filter((record) => {
          const current = Date.parse(record.retention.forgetAfter) > nowDate.getTime();
          if (!current) droppedItems.push({ sourceRef: record.memoryId, reason: "retention_expired" });
          return current;
        })
        .filter((record) => {
          if (!query.text) return true;
          return `${record.summary ?? ""}\n${record.content ?? ""}`.toLowerCase().includes(query.text.toLowerCase());
        })
        .map((record) => ({
          record: redactMemoryForRecall(record),
          citation: record.citation,
          inclusionReason: "permission and query matched",
        }));
      return { items, droppedItems };
    },
    assembleContext(input = {}) {
      const result = this.search(input);
      return createContextPack({
        runId: input.runId,
        now,
        items: result.items.map((item, index) => ({
          sourceRef: item.record.memoryId,
          kind: input.kind ?? "retrieved",
          priority: input.priorityBase ? input.priorityBase - index : 100 - index,
          inclusionReason: item.inclusionReason,
          citationId: item.citation.citationId,
          freshnessClass: item.citation.freshnessClass,
          tokenEstimate: estimateTokens(item.record.summary ?? item.record.content ?? ""),
        })),
        droppedItems: result.droppedItems,
      });
    },
    list() {
      return [...records.values()];
    },
  };
}

export function normalizeMemoryRecord(input, options = {}) {
  const now = options.now ?? (() => new Date());
  const recordedAt = input.source?.recordedAt ?? now().toISOString();
  const redactionScan = scanSensitive(input);
  const classification = input.redaction?.classification ?? (redactionScan.paths.length > 0 ? "secret_adjacent" : "internal");
  const mode = input.redaction?.mode ?? (classification === "secret_adjacent" ? "omitted" : "redacted");
  return {
    schemaVersion: SCHEMA_VERSION,
    memoryId: input.memoryId ?? makeId("mem", input.runId, input.kind ?? "memory"),
    kind: input.kind ?? "project",
    summary: mode === "omitted" ? "[omitted]" : input.summary,
    content: mode === "omitted" ? undefined : input.content,
    scope: {
      projectId: input.scope?.projectId ?? input.projectId ?? "proj_unknown",
      allowedActorIds: input.scope?.allowedActorIds ?? [],
      allowedScopes: input.scope?.allowedScopes ?? [],
    },
    source: {
      runId: input.source?.runId ?? input.runId ?? "run_unknown",
      artifactRef: input.source?.artifactRef,
      recordedAt,
    },
    freshness: {
      class: input.freshness?.class ?? "current_run",
      asOf: input.freshness?.asOf ?? recordedAt,
    },
    retention: {
      policy: input.retention?.policy ?? "project",
      forgetAfter: input.retention?.forgetAfter ?? new Date(Date.parse(recordedAt) + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    redaction: {
      classification,
      mode,
      redactedFields: [...new Set([...(input.redaction?.redactedFields ?? []), ...redactionScan.paths])],
    },
    citation: {
      citationId: input.citation?.citationId ?? makeId("cit", input.runId, input.kind ?? "memory"),
      label: input.citation?.label ?? input.summary ?? input.memoryId ?? "Memory record",
      freshnessClass: input.citation?.freshnessClass ?? input.freshness?.class ?? "current_run",
    },
  };
}

export function createContextPack(input = {}) {
  const now = input.now ?? (() => new Date());
  const items = [...(input.items ?? [])].sort((a, b) => b.priority - a.priority || a.sourceRef.localeCompare(b.sourceRef));
  const droppedItems = input.droppedItems ?? [];
  const replayShape = { runId: input.runId ?? "run_unknown", items, droppedItems };
  return {
    schemaVersion: SCHEMA_VERSION,
    contextPackId: input.contextPackId ?? makeId("ctx", input.runId, hashStable(replayShape).slice(7, 19)),
    runId: input.runId ?? "run_unknown",
    assembledAt: now().toISOString(),
    deterministicHash: hashStable(replayShape),
    items,
    droppedItems,
  };
}

function canReadMemory(record, actor, projectId) {
  if (projectId && record.scope.projectId !== projectId) return false;
  if (record.scope.allowedActorIds.length > 0 && !record.scope.allowedActorIds.includes(actor.actorId)) return false;
  const actorScopes = new Set(actor.scopes ?? []);
  return record.scope.allowedScopes.every((scope) => actorScopes.has(scope));
}

function resolveNow(value, fallback) {
  if (typeof value === "function") return value();
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return fallback();
}

function redactMemoryForRecall(record) {
  if (record.redaction.mode === "omitted") {
    return { ...record, content: undefined, summary: "[omitted]" };
  }
  if (record.redaction.mode !== "redacted") return record;
  return {
    ...record,
    content: redactString(record.content),
    summary: redactString(record.summary),
  };
}

function redactString(value) {
  if (typeof value !== "string") return value;
  return value.replace(/(secret|token|password|credential)[^\s]*/gi, "[redacted]");
}

function scanSensitive(value, path = "$") {
  const paths = [];
  walk(value, path, paths);
  return { paths };
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

function estimateTokens(value) {
  return Math.max(1, Math.ceil(String(value).length / 4));
}

function assertSearchableMemory(memory) {
  if (!memory?.capabilities || typeof memory.search !== "function") {
    throw new TypeError("memory search adapter requires a memory port with search()");
  }
}

function hashStable(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(sortObject(value))).digest("hex")}`;
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
    .replace(/^(run|mem|ctx|cit)_/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  return `${prefix}_${body || "record"}`;
}
