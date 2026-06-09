import { createHash } from "node:crypto";

const SCHEMA_VERSION = "2026-06-09";
const RUN_ID_PATTERN = /^run_[a-z0-9][a-z0-9_-]*$/;
const PROVIDER_ID_PATTERN = /^provider_[a-z0-9][a-z0-9_-]*$/;
const TOOL_ID_PATTERN = /^tool_[a-z0-9][a-z0-9_-]*$/;
const LOCAL_PROVIDER_ID = "provider_local_deterministic";
const UNSUPPORTED_EXTERNAL_PROVIDER_IDS = new Set([
  "provider_openai",
  "provider_anthropic",
  "provider_google",
  "provider_xai",
  "provider_azure_openai",
  "provider_bedrock",
]);
const SENSITIVE_FIELD_PATTERN = /secret|token|apiKey|credential|password|privatePayload|plaintext|value|authorization|cookie|session|prompt|systemPrompt|developerPrompt|userPrompt/i;

export class HarnessProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HarnessProviderError";
    this.code = code;
  }
}

export function createDeterministicProvider(options = {}) {
  const now = options.now ?? (() => new Date());
  const providerId = options.providerId ?? LOCAL_PROVIDER_ID;
  const manifest = localProviderCapabilityManifest({ providerId });
  const attempts = new Map();

  return {
    capabilities: {
      mode: "local_deterministic",
      provider: true,
      providerId,
      replacementPort: "harness.provider.model",
      manifest,
    },

    manifest,

    async generate(input = {}) {
      const route = normalizeRoute(input.providerId ?? providerId);
      if (route.status !== "supported") {
        return providerResult({
          now,
          runId: normalizeRunId(input.runId),
          providerId: route.providerId,
          status: "unsupported",
          reason: route.reason,
          toolCalls: [],
          output: {
            text: "Provider route is unsupported in this local foundation.",
            structured: { unsupportedProvider: route.providerId, failClosed: true },
          },
        });
      }

      const runId = normalizeRunId(input.runId);
      const attemptKey = `${runId}:${input.workflowId ?? "workflow_local"}`;
      const attempt = attempts.get(attemptKey) ?? 0;
      attempts.set(attemptKey, attempt + 1);

      if (input.failureMode === "fail_once" && attempt === 0) {
        return providerResult({
          now,
          runId,
          providerId: route.providerId,
          status: "failed_recoverable",
          reason: "deterministic provider configured to fail once before retry",
          toolCalls: [],
          output: {
            text: "Recoverable local provider failure.",
            structured: { recovery: "retry_same_checkpoint" },
          },
        });
      }

      const requestedToolId = typeof input.toolId === "string" && TOOL_ID_PATTERN.test(input.toolId)
        ? input.toolId
        : "tool_local_echo";
      const redactedInput = redactObject({
        instruction: input.instruction ?? "produce local harness evidence",
        contextHash: input.contextHash,
        memoryItemCount: input.memoryItemCount ?? 0,
      });

      return providerResult({
        now,
        runId,
        providerId: route.providerId,
        status: "completed",
        reason: "local deterministic provider produced a tool-backed workflow step",
        toolCalls: [{
          toolId: requestedToolId,
          input: {
            message: "local deterministic provider workflow",
            contextHash: input.contextHash,
            memoryItemCount: input.memoryItemCount ?? 0,
          },
        }],
        output: {
          text: "Local deterministic provider completed the workflow plan.",
          structured: {
            instruction: redactedInput.value.instruction,
            replayHash: hashStable(redactedInput.value),
          },
        },
        redactedFields: redactedInput.paths,
      });
    },
  };
}

export function createUnsupportedExternalProvider(providerId, options = {}) {
  const normalized = normalizeRoute(providerId);
  return {
    capabilities: {
      mode: "unsupported_external",
      provider: false,
      providerId: normalized.providerId,
      replacementPort: "harness.provider.model",
      manifest: unsupportedProviderCapabilityManifest(normalized.providerId),
    },
    manifest: unsupportedProviderCapabilityManifest(normalized.providerId),
    async generate(input = {}) {
      return providerResult({
        now: options.now ?? (() => new Date()),
        runId: normalizeRunId(input.runId),
        providerId: normalized.providerId,
        status: "unsupported",
        reason: "external model providers are not implemented or source-locked in this repo",
        toolCalls: [],
        output: {
          text: "External provider route is unavailable.",
          structured: { unsupportedProvider: normalized.providerId, failClosed: true },
        },
      });
    },
  };
}

export function validateProviderRoute(providerId) {
  return normalizeRoute(providerId);
}

export function localProviderCapabilityManifest({ providerId = LOCAL_PROVIDER_ID } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    capabilityId: "cap_local_deterministic_provider",
    ownerPackage: "@jami-studio/harness-provider-local",
    capabilityClass: "adapter",
    features: [
      { featureId: "provider.local_deterministic", support: "supported", notes: "Deterministic local provider emits typed workflow output and tool-call intent without contacting a hosted model." },
      { featureId: "model_replacement_port", support: "supported", notes: "Provider is injected through harness.provider.model and can be replaced without changing SDK run grammar." },
      { featureId: "tool_call_intent", support: "supported", notes: "Provider output can request a registered local tool that still executes only through the tool gateway and policy seam." },
      { featureId: "retry_recovery", support: "supported", notes: "A deterministic fail-once mode records recoverable failure before retrying from the same run checkpoint." },
      { featureId: "streaming", support: "unsupported", notes: "Streaming provider tokens are not implemented in this foundation pass." },
      { featureId: "hosted_models", support: "unsupported", notes: "OpenAI, Anthropic, Google, xAI, Azure OpenAI, Bedrock, and other hosted providers are not claimed." },
      { featureId: "provider_auth", support: "unsupported", notes: "No provider API keys, OAuth, or hosted credentials are read by this adapter." },
    ],
    requiredScopes: ["repo:read", "tool:local:execute"],
    failureModes: [
      { mode: "external_provider_unsupported", observableAs: "typed_result" },
      { mode: "recoverable_provider_failure", observableAs: "checkpoint_and_evidence" },
      { mode: "redacted_payload", observableAs: "evidence_packet" },
    ],
    replacementCompatibility: {
      portId: "harness.provider.model",
      contractVersion: SCHEMA_VERSION,
      mustPreserve: ["policy", "tool_gateway", "audit", "artifact", "evidence", "redaction", "checkpoint"],
    },
    metadata: {
      providerId,
      sourceLock: {
        sourceId: "local-deterministic-provider",
        evidenceDate: "2026-06-09",
        provenance: "first-party local adapter in this repository",
        license: "Apache-2.0",
      },
    },
  };
}

export function unsupportedProviderCapabilityManifest(providerId = "provider_external") {
  return {
    schemaVersion: SCHEMA_VERSION,
    capabilityId: `cap_${providerId.replace(/^provider_/, "")}_provider_unsupported`,
    ownerPackage: "@jami-studio/harness-provider-local",
    capabilityClass: "adapter",
    features: [
      { featureId: "hosted_provider_runtime", support: "unsupported", notes: "Hosted provider runtime is unavailable until source-lock, auth, policy, tracing, and fixtures land." },
      { featureId: "fail_closed", support: "supported", notes: "Unsupported provider routes return typed unsupported results and do not call network APIs." },
      { featureId: "provider_auth", support: "unsupported", notes: "No provider credentials are read or inferred." },
    ],
    requiredScopes: [],
    failureModes: [
      { mode: "external_provider_unsupported", observableAs: "typed_result" },
      { mode: "source_lock_missing", observableAs: "evidence_packet" },
    ],
    replacementCompatibility: {
      portId: "harness.provider.model",
      contractVersion: SCHEMA_VERSION,
      mustPreserve: ["policy", "audit", "artifact", "evidence", "redaction"],
    },
    metadata: { providerId },
  };
}

function providerResult({ now, runId, providerId, status, reason, toolCalls, output, redactedFields = [] }) {
  const completed = status === "completed";
  const generatedAt = now().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    providerRunId: makeId("prv", runId, providerId, status),
    runId,
    providerId,
    status,
    reason,
    generatedAt,
    output,
    toolCalls,
    evidenceRef: makeId("ev", runId, providerId, status),
    traceName: `provider.${status}`,
    redaction: {
      privatePayloadPolicy: redactedFields.length > 0 ? "redacted" : "none",
      redactedFields,
    },
    retryable: status === "failed_recoverable",
    executable: completed,
  };
}

function normalizeRoute(providerId = LOCAL_PROVIDER_ID) {
  const normalized = PROVIDER_ID_PATTERN.test(providerId) ? providerId : "provider_unsupported";
  if (normalized === LOCAL_PROVIDER_ID) {
    return { status: "supported", providerId: normalized };
  }
  if (UNSUPPORTED_EXTERNAL_PROVIDER_IDS.has(normalized) || normalized.startsWith("provider_")) {
    return {
      status: "unsupported",
      providerId: normalized,
      reason: "external providers fail closed until repo-local source-lock evidence, auth controls, and adapter fixtures exist",
    };
  }
  return { status: "unsupported", providerId: "provider_unsupported", reason: "provider id is malformed or unsupported" };
}

function normalizeRunId(runId) {
  if (typeof runId === "string" && RUN_ID_PATTERN.test(runId)) return runId;
  return "run_provider_unknown";
}

function redactObject(value, path = "$") {
  if (value === null || typeof value !== "object") return { value, paths: [] };
  const paths = [];
  return { value: redactWalk(value, path, paths), paths };
}

function redactWalk(value, path, paths) {
  if (typeof value === "string") {
    const redacted = value.replace(/\b(api[_-]?key|token|secret|password|credential|authorization|cookie|session)\b\s*[:=]\s*[^,\s;]+/gi, "$1=[redacted]");
    if (redacted !== value) paths.push(path);
    return redacted;
  }
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
    .replace(/^(run|provider|prv|ev)_/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  return `${prefix}_${body || "provider"}`;
}
