import { createHash } from "node:crypto";
import { createDeterministicProvider } from "@jami-studio/harness-provider-local";

const SCHEMA_VERSION = "2026-06-13.hosted-provider";
const RUN_ID_PATTERN = /^run_[a-z0-9][a-z0-9_-]*$/;
const PROVIDER_ID_PATTERN = /^provider_[a-z0-9][a-z0-9_-]*$/;
const LOCAL_PROVIDER_ID = "provider_local_deterministic";
const OPENAI_PROVIDER_ID = "provider_openai";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const SENSITIVE_PATTERN = /secret|api[_-]?key|credential|password|authorization|cookie|session|prompt|access[_-]?token|refresh[_-]?token|id[_-]?token|bearer/i;

export class HarnessHostedProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HarnessHostedProviderError";
    this.code = code;
  }
}

export function createHostedProviderRouter(options = {}) {
  const now = options.now ?? (() => new Date());
  const localProvider = options.localProvider ?? createDeterministicProvider({ now });
  const openaiProvider = options.openaiProvider ?? createOpenAIHostedProvider({
    now,
    env: options.env,
    fetchFn: options.fetchFn,
  });
  const manifest = hostedProviderRouterManifest({
    localManifest: localProvider.manifest,
    openaiManifest: openaiProvider.manifest,
  });

  return {
    capabilities: {
      mode: "provider_router_local_plus_hosted",
      provider: true,
      providerId: "provider_router",
      replacementPort: "harness.provider.model",
      manifest,
    },
    manifest,
    async generate(input = {}) {
      const route = normalizeProviderId(input.providerId ?? LOCAL_PROVIDER_ID);
      if (route.status === "malformed") {
        return hostedProviderResult({
          now,
          runId: normalizeRunId(input.runId),
          providerId: "provider_malformed",
          status: "malformed",
          reason: route.reason,
          output: {
            text: "Provider id is malformed.",
            structured: { failClosed: true, failureClass: "malformed_provider_id" },
          },
        });
      }
      if (route.providerId === LOCAL_PROVIDER_ID) return localProvider.generate(input);
      if (route.providerId === OPENAI_PROVIDER_ID) return openaiProvider.generate(input);
      return hostedProviderResult({
        now,
        runId: normalizeRunId(input.runId),
        providerId: route.providerId,
        status: "unsupported",
        reason: "hosted provider is not implemented by this adapter set",
        output: {
          text: "Hosted provider route is unsupported.",
          structured: { unsupportedProvider: route.providerId, failClosed: true },
        },
      });
    },
  };
}

export function createOpenAIHostedProvider(options = {}) {
  const now = options.now ?? (() => new Date());
  const env = options.env ?? process.env;
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const config = readOpenAIConfig(env);
  const manifest = openAIProviderManifest(config);

  return {
    capabilities: {
      mode: "hosted_openai_fail_closed",
      provider: true,
      providerId: OPENAI_PROVIDER_ID,
      replacementPort: "harness.provider.model",
      manifest,
    },
    manifest,
    async generate(input = {}) {
      const malformed = validateHostedInput(input);
      if (malformed) {
        return hostedProviderResult({
          now,
          runId: normalizeRunId(input.runId),
          providerId: OPENAI_PROVIDER_ID,
          status: "malformed",
          reason: malformed,
          output: {
            text: "Hosted provider request is malformed.",
            structured: { failClosed: true, failureClass: "malformed_request" },
          },
        });
      }
      if (!config.credential) {
        return hostedProviderResult({
          now,
          runId: normalizeRunId(input.runId),
          providerId: OPENAI_PROVIDER_ID,
          status: "auth_missing",
          reason: "JAMI_HARNESS_OPENAI_API_KEY is not configured",
          output: {
            text: "OpenAI hosted provider credentials are missing.",
            structured: redactedStructured({ failClosed: true, requiredEnv: ["JAMI_HARNESS_OPENAI_API_KEY"] }),
          },
        });
      }
      if (!config.model) {
        return hostedProviderResult({
          now,
          runId: normalizeRunId(input.runId),
          providerId: OPENAI_PROVIDER_ID,
          status: "source_missing",
          reason: "JAMI_HARNESS_OPENAI_MODEL is not configured",
          output: {
            text: "OpenAI hosted provider model source is missing.",
            structured: redactedStructured({ failClosed: true, requiredEnv: ["JAMI_HARNESS_OPENAI_MODEL"] }),
          },
        });
      }
      if (typeof fetchFn !== "function") {
        return hostedProviderResult({
          now,
          runId: normalizeRunId(input.runId),
          providerId: OPENAI_PROVIDER_ID,
          status: "source_missing",
          reason: "fetch runtime is unavailable for hosted provider execution",
          output: {
            text: "Hosted provider HTTP runtime is unavailable.",
            structured: { failClosed: true, failureClass: "fetch_unavailable" },
          },
        });
      }

      const request = openAIResponsesRequest(input, config.model);
      const startedAt = now().toISOString();
      const response = await fetchFn(`${config.baseUrl}/responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.credential}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
      });
      const body = await parseJsonBody(response);
      if (!response.ok) {
        return hostedProviderResult({
          now,
          runId: normalizeRunId(input.runId),
          providerId: OPENAI_PROVIDER_ID,
          status: "failed",
          reason: `OpenAI Responses API returned HTTP ${response.status}`,
          output: {
            text: "Hosted provider request failed.",
            structured: redactedStructured({
              failClosed: true,
              statusCode: response.status,
              errorType: body?.error?.type,
              errorCode: body?.error?.code,
            }),
          },
          usage: extractUsage(body),
          startedAt,
        });
      }

      return hostedProviderResult({
        now,
        runId: normalizeRunId(input.runId),
        providerId: OPENAI_PROVIDER_ID,
        status: "completed",
        reason: "OpenAI hosted provider completed a configured Responses API request",
        output: {
          text: extractOpenAIText(body),
          structured: redactedStructured({
            responseId: body?.id,
            model: body?.model ?? config.model,
            replayHash: hashStable({
              providerId: OPENAI_PROVIDER_ID,
              model: body?.model ?? config.model,
              outputText: extractOpenAIText(body),
            }),
          }),
        },
        usage: extractUsage(body),
        startedAt,
      });
    },
  };
}

export function readOpenAIConfig(env = process.env) {
  const baseUrl = String(env.JAMI_HARNESS_OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
  validateUrl(baseUrl);
  return {
    providerId: OPENAI_PROVIDER_ID,
    credential: nonEmpty(env.JAMI_HARNESS_OPENAI_API_KEY),
    model: nonEmpty(env.JAMI_HARNESS_OPENAI_MODEL),
    baseUrl,
    redacted: {
      apiKeyRef: "env:JAMI_HARNESS_OPENAI_API_KEY",
      modelRef: "env:JAMI_HARNESS_OPENAI_MODEL",
      baseUrl,
    },
  };
}

export function hostedProviderRouterManifest({ localManifest, openaiManifest } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    capabilityId: "cap_hosted_provider_router",
    ownerPackage: "@jami-studio/harness-provider-hosted",
    capabilityClass: "adapter",
    features: [
      { featureId: "provider.local_deterministic", support: "supported", notes: "Local deterministic provider behavior is delegated unchanged." },
      { featureId: "provider.openai.responses", support: "auth_required", notes: "OpenAI hosted execution requires explicit JAMI_HARNESS_OPENAI_API_KEY and JAMI_HARNESS_OPENAI_MODEL." },
      { featureId: "provider.auth_missing", support: "supported", notes: "Missing hosted credentials return typed auth_missing without calling the network." },
      { featureId: "provider.source_missing", support: "supported", notes: "Missing hosted model/source configuration returns typed source_missing without calling the network." },
      { featureId: "provider.redaction", support: "supported", notes: "Secrets are referenced by env var name only and never emitted." },
    ],
    routes: [
      { providerId: LOCAL_PROVIDER_ID, mode: "local", manifest: localManifest?.capabilityId },
      { providerId: OPENAI_PROVIDER_ID, mode: "hosted", manifest: openaiManifest?.capabilityId },
    ],
    failureModes: [
      { mode: "auth_missing", observableAs: "typed_result" },
      { mode: "source_missing", observableAs: "typed_result" },
      { mode: "malformed_request", observableAs: "typed_result" },
      { mode: "unsupported_provider", observableAs: "typed_result" },
      { mode: "redacted_payload", observableAs: "evidence_packet" },
    ],
    replacementCompatibility: {
      portId: "harness.provider.model",
      contractVersion: SCHEMA_VERSION,
      mustPreserve: ["policy", "audit", "artifact", "evidence", "redaction", "checkpoint"],
    },
  };
}

export function openAIProviderManifest(config = readOpenAIConfig({})) {
  return {
    schemaVersion: SCHEMA_VERSION,
    capabilityId: "cap_openai_responses_provider",
    ownerPackage: "@jami-studio/harness-provider-hosted",
    capabilityClass: "adapter",
    providerId: OPENAI_PROVIDER_ID,
    features: [
      { featureId: "responses_api", support: "auth_required", notes: "Uses the OpenAI Responses API over HTTPS when explicit env configuration is present." },
      { featureId: "streaming", support: "unsupported", notes: "This first adapter is explicit non-streaming." },
      { featureId: "tool_calls", support: "unsupported", notes: "Tool call translation is not implemented for hosted provider responses yet." },
      { featureId: "structured_outputs", support: "unsupported", notes: "Structured output schemas are not implemented for hosted provider responses yet." },
      { featureId: "cancellation", support: "unsupported", notes: "AbortSignal cancellation is not wired through the SDK run path yet." },
      { featureId: "usage", support: "supported", notes: "Usage fields are copied when the provider response supplies them." },
      { featureId: "redaction", support: "supported", notes: "Credential values are never returned in manifests, traces, or provider results." },
    ],
    requiredEnv: ["JAMI_HARNESS_OPENAI_API_KEY", "JAMI_HARNESS_OPENAI_MODEL"],
    optionalEnv: ["JAMI_HARNESS_OPENAI_BASE_URL"],
    auth: {
      type: "bearer_env",
      apiKeyRef: "env:JAMI_HARNESS_OPENAI_API_KEY",
      configured: Boolean(config.credential),
    },
    source: {
      modelRef: "env:JAMI_HARNESS_OPENAI_MODEL",
      configured: Boolean(config.model),
      baseUrl: config.baseUrl ?? DEFAULT_OPENAI_BASE_URL,
    },
    sourceLock: {
      sourceId: "openai-responses-api",
      evidenceDate: "2026-06-13",
      officialDocs: [
        "https://developers.openai.com/api/reference/overview/",
        "https://developers.openai.com/api/docs/guides/text",
      ],
    },
  };
}

function validateHostedInput(input) {
  const route = normalizeProviderId(input.providerId ?? OPENAI_PROVIDER_ID);
  if (route.status === "malformed") return route.reason;
  if (route.providerId !== OPENAI_PROVIDER_ID) return `OpenAI adapter cannot execute ${route.providerId}`;
  if (input.runId !== undefined && normalizeRunId(input.runId) === "run_provider_unknown") return "runId must match run_[a-z0-9][a-z0-9_-]*";
  if (input.instruction !== undefined && typeof input.instruction !== "string") return "instruction must be a string when provided";
  return undefined;
}

function openAIResponsesRequest(input, model) {
  return {
    model,
    input: input.instruction ?? "produce harness provider evidence",
    metadata: {
      harness_run_id: normalizeRunId(input.runId),
      harness_provider_id: OPENAI_PROVIDER_ID,
    },
  };
}

async function parseJsonBody(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function extractOpenAIText(body) {
  if (typeof body?.output_text === "string") return body.output_text;
  const output = Array.isArray(body?.output) ? body.output : [];
  const parts = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const entry of content) {
      if (typeof entry?.text === "string") parts.push(entry.text);
    }
  }
  return parts.join("\n") || "OpenAI hosted provider completed without text output.";
}

function extractUsage(body) {
  if (!body?.usage || typeof body.usage !== "object") return undefined;
  return redactedStructured({
    inputTokens: body.usage.input_tokens,
    outputTokens: body.usage.output_tokens,
    totalTokens: body.usage.total_tokens,
  });
}

function hostedProviderResult({ now, runId, providerId, status, reason, output, usage, startedAt }) {
  const generatedAt = now().toISOString();
  const redacted = redactObject({ output, usage });
  return {
    schemaVersion: SCHEMA_VERSION,
    providerRunId: makeId("prv", runId, providerId, status),
    runId,
    providerId,
    status,
    reason,
    generatedAt,
    startedAt,
    output: redacted.value.output,
    usage: redacted.value.usage,
    toolCalls: [],
    evidenceRef: makeId("ev", runId, providerId, status),
    traceName: `provider.${status}`,
    redaction: {
      privatePayloadPolicy: redacted.paths.length > 0 ? "redacted" : "none",
      redactedFields: redacted.paths,
      secretRefs: providerId === OPENAI_PROVIDER_ID ? ["env:JAMI_HARNESS_OPENAI_API_KEY"] : [],
    },
    retryable: false,
    executable: status === "completed",
  };
}

function normalizeProviderId(providerId) {
  if (typeof providerId !== "string" || !PROVIDER_ID_PATTERN.test(providerId)) {
    return { status: "malformed", providerId: "provider_malformed", reason: "providerId must match provider_[a-z0-9][a-z0-9_-]*" };
  }
  return { status: "ok", providerId };
}

function normalizeRunId(runId) {
  if (typeof runId === "string" && RUN_ID_PATTERN.test(runId)) return runId;
  return "run_provider_unknown";
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function validateUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new HarnessHostedProviderError("invalid_source_config", "JAMI_HARNESS_OPENAI_BASE_URL must be a valid HTTPS URL or localhost URL");
  }
}

function redactedStructured(value) {
  return redactObject(value).value;
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
    if (SENSITIVE_PATTERN.test(key) && !String(child).startsWith("env:")) {
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
