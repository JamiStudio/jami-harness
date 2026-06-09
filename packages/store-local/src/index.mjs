import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SCHEMA_VERSION = "2026-06-09";
const RUN_ID_PATTERN = /^run_[a-z0-9][a-z0-9_-]*$/;
const APPROVAL_ID_PATTERN = /^apr_[a-z0-9][a-z0-9_-]*$/;
const ACTION_ID_PATTERN = /^act_[a-z0-9][a-z0-9_-]*$/;
const ACTOR_ID_PATTERN = /^actor_[a-z0-9][a-z0-9_-]*$/;
const EVIDENCE_ID_PATTERN = /^ev_[a-z0-9][a-z0-9_-]*$/;
const SAFE_FILE_PATTERN = /^run_[a-z0-9][a-z0-9_-]*\.json$/;
const SENSITIVE_FIELD_PATTERN = /secret|token|apiKey|credential|password|privatePayload|plaintext|value|prompt|systemPrompt|developerPrompt|userPrompt/i;
const APPROVAL_STATUSES = new Set(["approved", "denied", "revoked", "expired"]);

export class HarnessStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HarnessStoreError";
    this.code = code;
  }
}

export function createInMemoryCheckpointStore(options = {}) {
  const now = options.now ?? (() => new Date());
  const checkpoints = new Map();
  const approvals = new Map();

  return checkpointPort({
    mode: "memory",
    durable: false,
    now,
    readRaw: (runId) => checkpoints.get(runId),
    writeRaw: (checkpoint) => {
      checkpoints.set(checkpoint.runId, checkpoint);
      return checkpoint;
    },
    listRaw: () => [...checkpoints.values()],
    writeApprovalRaw: (approval) => {
      const approvalsForRun = approvals.get(approval.runId) ?? [];
      approvalsForRun.push(approval);
      approvals.set(approval.runId, approvalsForRun);
      return approval;
    },
    listApprovalsRaw: (runId) => [...(approvals.get(runId) ?? [])],
  });
}

export function createFileSystemCheckpointStore(options = {}) {
  const now = options.now ?? (() => new Date());
  const root = resolve(options.root ?? ".jami-harness");
  const checkpointRoot = join(root, "checkpoints");
  const approvalRoot = join(root, "approvals");
  mkdirSync(checkpointRoot, { recursive: true });
  mkdirSync(approvalRoot, { recursive: true });

  return checkpointPort({
    mode: "filesystem",
    durable: true,
    root,
    now,
    readRaw: (runId) => readJsonIfExists(join(checkpointRoot, `${assertRunId(runId)}.json`)),
    writeRaw: (checkpoint) => {
      const file = join(checkpointRoot, `${assertRunId(checkpoint.runId)}.json`);
      writeFileSync(file, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
      return checkpoint;
    },
    listRaw: () => {
      if (!existsSync(checkpointRoot)) return [];
      return readdirSync(checkpointRoot)
        .filter((file) => SAFE_FILE_PATTERN.test(file))
        .sort()
        .map((file) => readJsonIfExists(join(checkpointRoot, file)))
        .filter(Boolean);
    },
    writeApprovalRaw: (approval) => {
      const runId = assertRunId(approval.runId);
      const dir = join(approvalRoot, runId);
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `${safeSegment(approval.approvalId)}.json`);
      writeFileSync(file, `${JSON.stringify(approval, null, 2)}\n`, "utf8");
      return approval;
    },
    listApprovalsRaw: (runId) => {
      const dir = join(approvalRoot, assertRunId(runId));
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((file) => /^[a-z0-9_-]+\.json$/.test(file))
        .sort()
        .map((file) => readJsonIfExists(join(dir, file)))
        .filter(Boolean);
    },
  });
}

function checkpointPort({ mode, durable, root, now, readRaw, writeRaw, listRaw, writeApprovalRaw, listApprovalsRaw }) {
  return {
    capabilities: {
      mode,
      durable,
      checkpoint: true,
      resume: true,
      approvals: true,
      redaction: "default",
      root,
    },

    writeCheckpoint(input) {
      const checkpoint = normalizeCheckpoint(input, { now, mode });
      return { written: true, checkpoint: writeRaw(checkpoint) };
    },

    readCheckpoint(runId) {
      return readRaw(assertRunId(runId));
    },

    listCheckpoints() {
      return listRaw();
    },

    resume(runId) {
      const checkpoint = readRaw(assertRunId(runId));
      if (!checkpoint) {
        return { resumable: false, reason: "checkpoint_not_found", runId };
      }
      if (checkpoint.status === "completed" || checkpoint.status === "failed") {
        return {
          resumable: false,
          reason: `run_${checkpoint.status}`,
          runId,
          checkpoint,
          replayHash: checkpoint.replayHash,
        };
      }
      return { resumable: true, runId, checkpoint, replayHash: checkpoint.replayHash };
    },

    writeApproval(input) {
      const approval = normalizeApproval(input, { now });
      return { written: true, approval: writeApprovalRaw(approval) };
    },

    listApprovals(runId) {
      return listApprovalsRaw(assertRunId(runId));
    },
  };
}

export function normalizeCheckpoint(input, options = {}) {
  const now = options.now ?? (() => new Date());
  const events = Array.isArray(input.events) ? input.events.map((event) => redactObject(event).value) : [];
  const artifacts = Array.isArray(input.artifacts) ? input.artifacts.map((artifact) => redactObject(artifact).value) : [];
  const pendingApprovals = Array.isArray(input.pendingApprovals)
    ? input.pendingApprovals.map((approval) => redactObject(approval).value)
    : [];
  const replayShape = {
    runId: assertRunId(input.runId),
    status: input.status ?? "checkpointed",
    sequence: input.sequence ?? events.length,
    events,
    artifacts,
    pendingApprovals,
  };
  const redactedFields = [
    ...events.flatMap((event) => redactObject(event).paths),
    ...artifacts.flatMap((artifact) => redactObject(artifact).paths),
    ...pendingApprovals.flatMap((approval) => redactObject(approval).paths),
  ];
  return {
    schemaVersion: SCHEMA_VERSION,
    checkpointId: input.checkpointId ?? makeId("chk", input.runId, input.status ?? "checkpointed"),
    runId: assertRunId(input.runId),
    status: input.status ?? "checkpointed",
    sequence: input.sequence ?? events.length,
    recordedAt: input.recordedAt ?? now().toISOString(),
    source: {
      repo: input.source?.repo ?? input.sourceRepo ?? "jami-harness",
      commit: input.source?.commit ?? input.sourceCommit ?? "working-tree",
      ref: input.source?.ref ?? input.sourceRef ?? "refs/heads/main",
    },
    events,
    artifacts,
    pendingApprovals,
    replayHash: hashStable(replayShape),
    redaction: {
      privatePayloadPolicy: redactedFields.length > 0 ? "redacted" : "none",
      redactedFields: [...new Set(redactedFields)],
    },
    store: {
      mode: options.mode ?? "unknown",
      durable: options.mode === "filesystem",
    },
  };
}

export function normalizeApproval(input, options = {}) {
  const now = options.now ?? (() => new Date());
  const runId = assertRunId(input.runId);
  const actionId = assertPattern("action id", input.actionId ?? "act_unspecified", ACTION_ID_PATTERN);
  const actorId = assertPattern("actor id", input.actorId ?? "actor_developer", ACTOR_ID_PATTERN);
  const status = input.status ?? "approved";
  if (!APPROVAL_STATUSES.has(status)) {
    throw new HarnessStoreError("invalid_approval_status", `approval status must be one of ${[...APPROVAL_STATUSES].join(", ")}`);
  }
  const approvedAt = input.approvedAt ?? now().toISOString();
  const approvedAtMs = Date.parse(approvedAt);
  if (!Number.isFinite(approvedAtMs)) {
    throw new HarnessStoreError("invalid_timestamp", "approval approvedAt must be an ISO timestamp");
  }
  const expiresAtMs = input.expiresAt ? Date.parse(input.expiresAt) : undefined;
  if (input.expiresAt && !Number.isFinite(expiresAtMs)) {
    throw new HarnessStoreError("invalid_timestamp", "approval expiresAt must be an ISO timestamp");
  }
  if (expiresAtMs !== undefined && expiresAtMs <= approvedAtMs) {
    throw new HarnessStoreError("invalid_approval_expiry", "approval expiresAt must be after approvedAt");
  }
  const approvalId = input.approvalId ?? makeId("apr", runId, actionId);
  assertPattern("approval id", approvalId, APPROVAL_ID_PATTERN);
  const evidenceRef = input.evidenceRef ?? makeId("ev", runId, actionId, "approval");
  assertPattern("evidence ref", evidenceRef, EVIDENCE_ID_PATTERN);
  return {
    schemaVersion: SCHEMA_VERSION,
    approvalId,
    runId,
    actionId,
    actorId,
    status,
    scopes: Array.isArray(input.scopes) ? input.scopes : [],
    approvedAt,
    expiresAt: input.expiresAt,
    evidenceRef,
  };
}

function assertRunId(value) {
  if (typeof value === "string" && RUN_ID_PATTERN.test(value)) return value;
  throw new HarnessStoreError("invalid_identifier", `run id must match ${RUN_ID_PATTERN.source}`);
}

function assertPattern(label, value, pattern) {
  if (typeof value === "string" && pattern.test(value)) return value;
  throw new HarnessStoreError("invalid_identifier", `${label} must match ${pattern.source}`);
}

function safeSegment(value) {
  const segment = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  if (!segment) throw new HarnessStoreError("invalid_identifier", "identifier segment is empty after normalization");
  return segment;
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8"));
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
    if (SENSITIVE_FIELD_PATTERN.test(key)) {
      output[key] = "[redacted]";
      paths.push(childPath);
      continue;
    }
    output[key] = redactWalk(child, childPath, paths);
  }
  return output;
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
    .replace(/^(run|chk|apr|ev)_/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  return `${prefix}_${body || "record"}`;
}
