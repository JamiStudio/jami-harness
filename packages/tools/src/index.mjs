import { createHash } from "node:crypto";
import { createInMemoryArtifactStore } from "../../artifacts/src/index.mjs";
import { createRunObservability } from "../../observability/src/index.mjs";
import { createDefaultPolicyEngine } from "../../policy/src/index.mjs";

const SCHEMA_VERSION = "2026-06-09";
export const MCP_PROTOCOL_VERSION = "2025-11-25";
const TOOL_ID_PATTERN = /^tool_[a-z0-9][a-z0-9_-]*$/;
const ADAPTER_ID_PATTERN = /^adapter_[a-z0-9][a-z0-9_-]*$/;
const RUN_ID_PATTERN = /^run_[a-z0-9][a-z0-9_-]*$/;
const ACTOR_ID_PATTERN = /^actor_[a-z0-9][a-z0-9_-]*$/;
const PROJECT_ID_PATTERN = /^proj_[a-z0-9][a-z0-9_-]*$/;
const MCP_TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;
const ALLOWED_RISKS = new Set(["read", "write", "destructive", "external", "secret_adjacent"]);
const ELEVATED_RISKS = new Set(["write", "destructive", "external", "secret_adjacent"]);
const EXECUTABLE_ADAPTER_IDS = new Set(["adapter_function", "adapter_mcp"]);
const TRUSTED_MCP_FIXTURE_TOOL = Symbol("trustedMcpFixtureTool");
const SENSITIVE_FIELD_PATTERN = /secret|token|apiKey|credential|password|privatePayload|plaintext|value|authorization|cookie|session|prompt|systemPrompt|developerPrompt|userPrompt|toolMetadata|toolSchema|toolDescription/i;
const MCP_METADATA_POISON_PATTERN = /ignore\s+(policy|approval|instructions)|bypass\s+(policy|approval)|exfiltrate|leak\s+(secret|token|credential)|send\s+.*(secret|token|credential)/i;

const MCP_SOURCE_LOCK = {
  sourceId: "mcp-spec-2025-11-25",
  protocolVersion: MCP_PROTOCOL_VERSION,
  evidenceDate: "2026-06-09",
  officialUrls: [
    "https://modelcontextprotocol.io/specification/2025-11-25",
    "https://modelcontextprotocol.io/specification/2025-11-25/basic/transports",
    "https://modelcontextprotocol.io/specification/2025-11-25/server/tools",
    "https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization",
    "https://modelcontextprotocol.io/specification/2025-11-25/changelog",
  ],
};

const TOOL_ADAPTER_CATALOG = [
  {
    adapterId: "adapter_function",
    shortId: "function",
    support: "supported",
    label: "Function tool adapter",
    sourceLock: {
      sourceId: "function-tool-first-party",
      status: "first_party",
      evidenceDate: "2026-06-09",
      provenance: "First-party dependency-free adapter in @jami-studio/harness-tools.",
      refreshTrigger: "Any handler contract, execution envelope, policy, artifact, or redaction change.",
    },
    dryRunToolId: "tool_function_dry_run",
    unsupportedReason: undefined,
  },
  {
    adapterId: "adapter_mcp",
    shortId: "mcp",
    support: "supported",
    label: "MCP trusted fixture adapter",
    sourceLock: {
      ...MCP_SOURCE_LOCK,
      status: "locked",
      provenance: "Official MCP protocol pages locked in docs/operations/mcp-source-lock.md.",
      refreshTrigger: "Any MCP support beyond trusted in-process fixture tools or a newer official MCP spec.",
    },
    dryRunToolId: "tool_mcp_dry_run",
    unsupportedReason: "Remote MCP stdio, Streamable HTTP, OAuth, resources, prompts, roots, sampling, elicitation, tasks, and resumability remain unsupported.",
  },
  {
    adapterId: "adapter_openapi",
    shortId: "openapi",
    support: "unsupported",
    label: "OpenAPI tool adapter",
    sourceLock: missingSourceLock("openapi-tool-adapter-source-lock", "OpenAPI parsing, operation discovery, HTTP execution, request auth, and schema coercion."),
    dryRunToolId: "tool_openapi_dry_run",
    unsupportedReason: "OpenAPI parsing and HTTP execution are unavailable until repo-local source-lock evidence and adapter fixtures land.",
  },
  {
    adapterId: "adapter_shell",
    shortId: "shell",
    support: "unsupported",
    label: "Local shell tool adapter",
    sourceLock: missingSourceLock("shell-tool-adapter-source-lock", "Command execution, sandbox policy, working-directory limits, environment filtering, and output redaction."),
    dryRunToolId: "tool_shell_dry_run",
    unsupportedReason: "Shell execution is unavailable until sandbox policy, source-lock evidence, and negative fixtures land.",
  },
  {
    adapterId: "adapter_browser",
    shortId: "browser",
    support: "unsupported",
    label: "Browser tool adapter",
    sourceLock: missingSourceLock("browser-tool-adapter-source-lock", "Browser automation package choice, install provenance, local target policy, and screenshot/evidence handling."),
    dryRunToolId: "tool_browser_dry_run",
    unsupportedReason: "Browser automation is unavailable until the browser driver/package is source-locked and policy fixtures exist.",
  },
  {
    adapterId: "adapter_code",
    shortId: "code",
    support: "unsupported",
    label: "Code execution tool adapter",
    sourceLock: missingSourceLock("code-tool-adapter-source-lock", "Code runner sandbox, language runtime selection, filesystem isolation, and artifact capture."),
    dryRunToolId: "tool_code_dry_run",
    unsupportedReason: "Code execution is unavailable until sandbox/runtime source-lock evidence and isolation fixtures land.",
  },
  {
    adapterId: "adapter_provider",
    shortId: "provider",
    support: "unsupported",
    label: "Provider-as-tool adapter",
    sourceLock: missingSourceLock("provider-as-tool-source-lock", "Provider-as-tool routing, auth, hosted API boundaries, and provider/tool trace handoff."),
    dryRunToolId: "tool_provider_dry_run",
    unsupportedReason: "Provider-as-tool execution is unavailable; model routing stays behind harness.provider.model and hosted providers fail closed.",
  },
  {
    adapterId: "adapter_a2a",
    shortId: "a2a",
    support: "unsupported",
    label: "A2A interop adapter",
    sourceLock: missingSourceLock("a2a-tool-adapter-source-lock", "A2A agent-card/task interop, auth, task lifecycle, and trace handoff."),
    dryRunToolId: "tool_a2a_dry_run",
    unsupportedReason: "A2A interop execution is unavailable until protocol source-lock evidence and fixtures land.",
  },
];

export class ToolGatewayError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ToolGatewayError";
    this.code = code;
  }
}

export function createToolRegistry(options = {}) {
  const tools = new Map();
  const manifests = new Map();

  for (const manifest of createToolAdapterManifests()) {
    manifests.set(manifest.capabilityId, manifest);
  }

  return {
    register(tool) {
      const normalized = normalizeToolDefinition(tool);
      if (tools.has(normalized.toolId)) {
        throw new ToolGatewayError("duplicate_tool", `tool already registered: ${normalized.toolId}`);
      }
      tools.set(normalized.toolId, normalized);
      manifests.set(normalized.capabilityManifest.capabilityId, normalized.capabilityManifest);
      return normalized;
    },

    get(toolId) {
      return tools.get(toolId);
    },

    list() {
      return [...tools.values()].map(({ handler: _handler, ...tool }) => tool);
    },

    manifests() {
      return [...manifests.values()];
    },

    capabilities() {
      return {
        schemaVersion: SCHEMA_VERSION,
        mode: options.mode ?? "memory",
        supportedAdapters: TOOL_ADAPTER_CATALOG.filter((adapter) => adapter.support === "supported").map((adapter) => adapter.adapterId),
        unsupportedAdapters: TOOL_ADAPTER_CATALOG.filter((adapter) => adapter.support === "unsupported").map((adapter) => adapter.adapterId),
        adapterSourceLocks: listToolAdapterSourceLocks(),
        replacementPort: "harness.tools.registry",
      };
    },
  };
}

export function createFunctionTool(tool) {
  return {
    adapterId: "adapter_function",
    ...tool,
  };
}

export function createTrustedMcpFixtureServer(options = {}) {
  const protocolVersion = options.protocolVersion ?? MCP_PROTOCOL_VERSION;
  const tools = new Map();
  for (const tool of options.tools ?? []) {
    assertMcpToolMetadata(tool);
    tools.set(tool.name, tool);
  }

  return {
    protocolVersion,
    transport: { kind: "mcp_in_process", trusted: true },

    async request(message = {}) {
      if (message.jsonrpc !== "2.0") {
        return jsonRpcError(message.id, -32600, "invalid JSON-RPC 2.0 request");
      }
      if (message.method === "initialize") {
        return jsonRpcResult(message.id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: options.name ?? "jami-harness-mcp-fixture",
            version: "0.0.0-fixture",
            description: "Trusted in-process MCP fixture for harness adapter tests",
          },
        });
      }
      if (message.method === "tools/list") {
        return jsonRpcResult(message.id, {
          tools: [...tools.values()].map(({ handler: _handler, risk: _risk, requiredScopes: _requiredScopes, ...tool }) => tool),
        });
      }
      if (message.method === "tools/call") {
        const name = message.params?.name;
        const tool = tools.get(name);
        if (!tool) return jsonRpcError(message.id, -32602, "unknown MCP tool");
        const result = await tool.handler?.(message.params?.arguments ?? {});
        return jsonRpcResult(message.id, result ?? { content: [] });
      }
      return jsonRpcError(message.id, -32601, "unsupported MCP fixture method");
    },
  };
}

export async function registerMcpServerTools(registry, options = {}) {
  assertPort("registry", registry, ["register"]);
  const discovered = await discoverMcpServerTools(options);
  return discovered.map((tool) => registry.register(tool));
}

export async function discoverMcpServerTools(options = {}) {
  const server = options.server;
  if (!server || typeof server.request !== "function") {
    throw new ToolGatewayError("invalid_mcp_server", "MCP server must expose a request method");
  }
  const sourceLock = options.sourceLock ?? MCP_SOURCE_LOCK;
  assertMcpSourceLock(sourceLock);
  const serverTrust = options.serverTrust ?? "trusted";
  if (serverTrust !== "trusted") {
    throw new ToolGatewayError("untrusted_mcp_server", "MCP tool metadata is accepted only from trusted servers in this foundation pass");
  }

  const initialized = await mcpRequest(server, "initialize", {
    protocolVersion: sourceLock.protocolVersion,
    capabilities: {},
    clientInfo: { name: "jami-harness-tools", version: "0.0.0" },
  });
  const negotiatedVersion = initialized.protocolVersion ?? server.protocolVersion;
  if (negotiatedVersion !== sourceLock.protocolVersion) {
    throw new ToolGatewayError("unsupported_mcp_protocol", `MCP protocol version must be ${sourceLock.protocolVersion}`);
  }

  const listed = await mcpRequest(server, "tools/list", {});
  if (!Array.isArray(listed.tools)) {
    throw new ToolGatewayError("invalid_mcp_tools", "MCP tools/list result must include a tools array");
  }

  return listed.tools.map((metadata) => {
    assertMcpToolMetadata(metadata);
    const toolId = toHarnessToolId(metadata.name);
    const risk = options.riskByToolName?.[metadata.name] ?? metadata.risk ?? "read";
    const requiredScopes = options.requiredScopesByToolName?.[metadata.name] ?? metadata.requiredScopes ?? ["repo:read"];
    return {
      toolId,
      label: metadata.title ?? metadata.name,
      adapterId: "adapter_mcp",
      risk,
      sideEffect: risk === "read" ? "none" : "writes",
      requiredScopes,
      timeoutMs: options.timeoutMs ?? 30_000,
      inputSchema: metadata.inputSchema,
      resultShape: "mcp_tool_result",
      artifactKind: "evidence",
      mcp: {
        serverId: options.serverId ?? "trusted_fixture",
        toolName: metadata.name,
        protocolVersion: sourceLock.protocolVersion,
        transport: "in_process_fixture",
      },
      capabilityManifest: mcpCapabilityManifest({ requiredScopes, sourceLock }),
      [TRUSTED_MCP_FIXTURE_TOOL]: true,
      async handler(input) {
        return mcpRequest(server, "tools/call", { name: metadata.name, arguments: input ?? {} });
      },
    };
  });
}

export function validateMcpStreamableHttpRequest(input = {}) {
  const allowedOrigins = new Set(input.allowedOrigins ?? []);
  const origin = input.origin;
  if (origin && !allowedOrigins.has(origin)) {
    return { ok: false, status: 403, code: "invalid_origin", message: "invalid Origin header" };
  }
  if (input.protocolVersion !== MCP_PROTOCOL_VERSION) {
    return { ok: false, status: 400, code: "unsupported_protocol_version", message: `MCP-Protocol-Version must be ${MCP_PROTOCOL_VERSION}` };
  }
  if (input.requireSession !== false && !isVisibleAscii(input.sessionId)) {
    return { ok: false, status: 400, code: "invalid_session", message: "MCP-Session-Id is required and must be visible ASCII" };
  }
  if (input.localhostBinding === "public") {
    return { ok: false, status: 403, code: "public_local_binding", message: "local MCP HTTP servers must not bind publicly" };
  }
  return { ok: true, status: 200, code: "accepted", message: "MCP Streamable HTTP request controls accepted" };
}

export function createUnsupportedAdapterManifests() {
  return TOOL_ADAPTER_CATALOG
    .filter((adapter) => adapter.support === "unsupported")
    .map((adapter) => unsupportedCapabilityManifest(adapter));
}

export function createToolAdapterManifests() {
  return TOOL_ADAPTER_CATALOG.map((adapter) => {
    if (adapter.adapterId === "adapter_function") return functionCapabilityManifest();
    if (adapter.adapterId === "adapter_mcp") return mcpCapabilityManifest({ sourceLock: MCP_SOURCE_LOCK, support: "supported" });
    return unsupportedCapabilityManifest(adapter);
  });
}

export function listToolAdapterCapabilities() {
  return TOOL_ADAPTER_CATALOG.map((adapter) => ({
    adapterId: adapter.adapterId,
    capabilityId: capabilityIdForAdapter(adapter),
    label: adapter.label,
    support: adapter.support,
    dryRunToolId: adapter.dryRunToolId,
    sourceLock: adapter.sourceLock,
    unsupportedReason: adapter.unsupportedReason,
  }));
}

export function listToolAdapterSourceLocks() {
  return TOOL_ADAPTER_CATALOG.map((adapter) => ({
    adapterId: adapter.adapterId,
    sourceId: adapter.sourceLock.sourceId,
    status: adapter.sourceLock.status,
    evidenceDate: adapter.sourceLock.evidenceDate,
    protocolVersion: adapter.sourceLock.protocolVersion,
    provenance: adapter.sourceLock.provenance,
    requiredBefore: adapter.sourceLock.requiredBefore,
    refreshTrigger: adapter.sourceLock.refreshTrigger,
    officialUrls: adapter.sourceLock.officialUrls ?? [],
  }));
}

export function createUnsupportedAdapterTool(adapterId, options = {}) {
  const adapter = adapterForId(adapterId);
  if (adapter.support !== "unsupported") {
    throw new ToolGatewayError("adapter_supported", `${adapter.adapterId} has an executable local fixture path; use the adapter-specific fixture instead`);
  }
  return {
    toolId: options.toolId ?? adapter.dryRunToolId,
    label: options.label ?? `${adapter.label} dry-run`,
    adapterId: adapter.adapterId,
    risk: options.risk ?? "read",
    sideEffect: "none",
    requiredScopes: options.requiredScopes ?? ["repo:read"],
    timeoutMs: options.timeoutMs ?? 1000,
    inputSchema: options.inputSchema ?? {
      type: "object",
      properties: {
        dryRun: { type: "boolean" },
        requestedSurface: { type: "string" },
      },
    },
    resultShape: "unsupported_dry_run",
    artifactKind: "evidence",
    capabilityManifest: unsupportedCapabilityManifest(adapter),
  };
}

export async function dryRunUnsupportedAdapter(options = {}) {
  const adapterId = options.adapterId ?? "adapter_openapi";
  const adapter = adapterForId(adapterId);
  if (adapter.support !== "unsupported") {
    throw new ToolGatewayError("adapter_supported", `${adapter.adapterId} is not an unsupported adapter dry-run target`);
  }
  const registry = options.registry ?? createToolRegistry();
  const tool = registry.get(adapter.dryRunToolId) ?? registry.register(createUnsupportedAdapterTool(adapter.adapterId));
  const gateway = options.gateway ?? createToolGateway({
    registry,
    artifactStore: options.artifactStore,
    observability: options.observability,
    policyEngine: options.policyEngine,
    now: options.now,
  });
  return gateway.execute({
    runId: options.runId ?? "run_adapter_dry_run",
    toolId: tool.toolId,
    actor: options.actor ?? { actorId: "actor_developer", scopes: ["repo:read"] },
    projectId: options.projectId ?? "proj_jami_harness",
    environment: options.environment ?? "local",
    input: options.input ?? {
      dryRun: true,
      adapterId: adapter.adapterId,
      requestedSurface: adapter.label,
      sourceLockStatus: adapter.sourceLock.status,
    },
  });
}

export function createToolGateway(options = {}) {
  const now = options.now ?? (() => new Date());
  const registry = options.registry ?? createToolRegistry();
  const artifactStore = options.artifactStore ?? createInMemoryArtifactStore({ now });
  const observability = options.observability ?? createRunObservability({ now, artifactStore });
  const policyEngine = options.policyEngine ?? createDefaultPolicyEngine({ now });

  assertPort("registry", registry, ["get", "list", "manifests"]);
  assertPort("artifactStore", artifactStore, ["write", "list"]);
  assertPort("observability", observability, ["trace", "exportEvidencePacket"]);
  assertPort("policyEngine", policyEngine, ["evaluate"]);

  return {
    registry,
    artifactStore,
    observability,

    async execute(input = {}) {
      const startedAt = now().toISOString();
      const runId = normalizeId("run", input.runId, "run_tool_gateway");
      const actor = normalizeActor(input.actor);
      const projectId = normalizeId("proj", input.projectId, "proj_jami_harness");
      const environment = input.environment ?? "unknown";
      const tool = registry.get(input.toolId);
      const toolId = TOOL_ID_PATTERN.test(input.toolId ?? "") ? input.toolId : "tool_unknown";
      const executionId = input.executionId ?? makeId("tex", runId, toolId, "execution");
      const inputRedaction = redactObject(input.input ?? {});

      if (!tool) {
        return finalizeExecution({
          now,
          artifactStore,
          observability,
          executionId,
          runId,
          toolId,
          adapterId: "adapter_unknown",
          status: "unsupported",
          startedAt,
          endedAt: now().toISOString(),
          policyDecision: denyDecision({ runId, actor, projectId, environment, toolId, reason: "tool is not registered", now }),
          auditEvent: auditForDecision({ runId, actor, projectId, environment, toolId, outcome: "deny", reason: "tool is not registered", now }),
          inputRedaction,
          resultRedaction: { value: undefined, paths: [] },
          error: { code: "tool_unsupported", message: "tool is not registered" },
          capabilityManifestRef: "cap_unknown_tool_gateway",
        });
      }

      const policyRequest = toPolicyRequest({ input, tool, runId, actor, projectId, environment });
      let policyDecision;
      try {
        policyDecision = await policyEngine.evaluate(policyRequest);
      } catch (error) {
        const policyError = sanitizeError(error, "policy_failed_closed");
        return finalizeExecution({
          now,
          artifactStore,
          observability,
          executionId,
          runId,
          toolId,
          adapterId: tool.adapterId,
          status: "denied",
          startedAt,
          endedAt: now().toISOString(),
          policyDecision: denyDecision({ runId, actor, projectId, environment, toolId, reason: `policy engine failed closed: ${policyError.message}`, now }),
          auditEvent: auditForDecision({ runId, actor, projectId, environment, toolId, outcome: "deny", reason: "policy engine failed closed", now }),
          inputRedaction,
          resultRedaction: { value: undefined, paths: [] },
          error: { code: policyError.code, message: "policy engine failed closed" },
          capabilityManifestRef: tool.capabilityManifest.capabilityId,
          timeoutMs: tool.timeoutMs,
        });
      }
      const auditEvent = auditForPolicyDecision({ decision: policyDecision, runId, actor, projectId, environment, toolId, now });
      await observability.auditSink?.write?.(auditEvent);

      if (policyDecision.decision !== "allow") {
        return finalizeExecution({
          now,
          artifactStore,
          observability,
          executionId,
          runId,
          toolId,
          adapterId: tool.adapterId,
          status: "denied",
          startedAt,
          endedAt: now().toISOString(),
          policyDecision,
          auditEvent,
          inputRedaction,
          resultRedaction: { value: undefined, paths: [] },
          error: { code: "policy_denied", message: policyDecision.reasons.join("; ") },
          capabilityManifestRef: tool.capabilityManifest.capabilityId,
          timeoutMs: tool.timeoutMs,
        });
      }

      if (tool.support === "unsupported" || !EXECUTABLE_ADAPTER_IDS.has(tool.adapterId)) {
        return finalizeExecution({
          now,
          artifactStore,
          observability,
          executionId,
          runId,
          toolId,
          adapterId: tool.adapterId,
          status: "unsupported",
          startedAt,
          endedAt: now().toISOString(),
          policyDecision,
          auditEvent,
          inputRedaction,
          resultRedaction: { value: undefined, paths: [] },
          error: {
            code: "adapter_unsupported",
            message: `${tool.adapterId} is declared unsupported until current source-lock evidence is refreshed`,
          },
          capabilityManifestRef: tool.capabilityManifest.capabilityId,
          timeoutMs: tool.timeoutMs,
        });
      }

      const controller = new AbortController();
      const timeoutMs = input.timeoutMs ?? tool.timeoutMs;
      const externalSignal = input.signal;
      let timeoutHandle;
      let externalAbortHandler;

      if (externalSignal?.aborted) controller.abort(externalSignal.reason);
      if (externalSignal?.addEventListener) {
        externalAbortHandler = () => controller.abort(externalSignal.reason);
        externalSignal.addEventListener("abort", externalAbortHandler, { once: true });
      }
      if (timeoutMs) {
        timeoutHandle = setTimeout(() => controller.abort(new ToolGatewayError("timeout", `tool timed out after ${timeoutMs}ms`)), timeoutMs);
      }

      try {
        const result = await raceHandlerWithCancellation({
          handlerPromise: Promise.resolve().then(() => tool.handler(input.input ?? {}, {
            signal: controller.signal,
            tool,
            runId,
            executionId,
          })),
          signal: controller.signal,
        });
        const resultRedaction = redactObject(result ?? {});
        return finalizeExecution({
          now,
          artifactStore,
          observability,
          executionId,
          runId,
          toolId,
          adapterId: tool.adapterId,
          status: "completed",
          startedAt,
          endedAt: now().toISOString(),
          policyDecision,
          auditEvent,
          inputRedaction,
          resultRedaction,
          capabilityManifestRef: tool.capabilityManifest.capabilityId,
          timeoutMs,
        });
      } catch (error) {
        const aborted = controller.signal.aborted;
        const status = aborted && controller.signal.reason?.code === "timeout" ? "timeout" : aborted ? "cancelled" : "failed";
        return finalizeExecution({
          now,
          artifactStore,
          observability,
          executionId,
          runId,
          toolId,
          adapterId: tool.adapterId,
          status,
          startedAt,
          endedAt: now().toISOString(),
          policyDecision,
          auditEvent,
          inputRedaction,
          resultRedaction: { value: undefined, paths: [] },
          capabilityManifestRef: tool.capabilityManifest.capabilityId,
          timeoutMs,
          error: sanitizeError(error, status),
        });
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (externalSignal?.removeEventListener && externalAbortHandler) {
          externalSignal.removeEventListener("abort", externalAbortHandler);
        }
      }
    },
  };
}

function raceHandlerWithCancellation({ handlerPromise, signal }) {
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new ToolGatewayError("cancelled", "tool execution was cancelled"));
  }

  return Promise.race([
    handlerPromise,
    new Promise((_, reject) => {
      signal.addEventListener("abort", () => {
        reject(signal.reason ?? new ToolGatewayError("cancelled", "tool execution was cancelled"));
      }, { once: true });
    }),
  ]);
}

function sanitizeError(error, fallbackCode) {
  const code = String(error?.code ?? fallbackCode).replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
  const message = error instanceof Error ? error.message : String(error ?? fallbackCode);
  const redacted = redactObject({ message });

  return {
    code: code || fallbackCode,
    message: redacted.value.message,
  };
}

function normalizeToolDefinition(tool) {
  if (!tool || typeof tool !== "object") {
    throw new ToolGatewayError("invalid_tool", "tool definition must be an object");
  }
  if (!TOOL_ID_PATTERN.test(tool.toolId ?? "")) {
    throw new ToolGatewayError("invalid_tool", "toolId must match tool_*");
  }
  const adapterId = tool.adapterId ?? "adapter_function";
  if (!ADAPTER_ID_PATTERN.test(adapterId)) {
    throw new ToolGatewayError("invalid_tool", "adapterId must match adapter_*");
  }
  if (!ALLOWED_RISKS.has(tool.risk)) {
    throw new ToolGatewayError("invalid_tool", "tool risk is required and must be supported");
  }
  if (!Array.isArray(tool.requiredScopes)) {
    throw new ToolGatewayError("invalid_tool", "requiredScopes must be an array");
  }

  const support = isExecutableAdapterTool(tool, adapterId) ? "supported" : "unsupported";
  if (support === "supported" && typeof tool.handler !== "function") {
    throw new ToolGatewayError("invalid_tool", "supported tools must provide a handler");
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    toolId: tool.toolId,
    label: tool.label ?? tool.toolId,
    adapterId,
    risk: tool.risk,
    sideEffect: tool.sideEffect ?? (tool.risk === "read" ? "none" : "writes"),
    requiredScopes: [...tool.requiredScopes],
    timeoutMs: tool.timeoutMs ?? 30_000,
    support,
    inputSchema: tool.inputSchema ?? { type: "object" },
    resultShape: tool.resultShape ?? "json",
    artifactKind: tool.artifactKind ?? "report",
    handler: tool.handler,
    capabilityManifest: tool.capabilityManifest ?? capabilityManifestForTool(tool, adapterId, support),
  };
}

function isExecutableAdapterTool(tool, adapterId) {
  if (!EXECUTABLE_ADAPTER_IDS.has(adapterId) || typeof tool.handler !== "function") return false;
  if (adapterId === "adapter_function") return true;
  if (adapterId === "adapter_mcp") {
    return tool[TRUSTED_MCP_FIXTURE_TOOL] === true
      && tool.mcp?.transport === "in_process_fixture"
      && tool.mcp?.protocolVersion === MCP_PROTOCOL_VERSION
      && MCP_TOOL_NAME_PATTERN.test(tool.mcp?.toolName ?? "");
  }
  return false;
}

function toPolicyRequest({ input, tool, runId, actor, projectId, environment }) {
  return {
    runId,
    actor,
    projectId,
    environment,
    action: {
      actionId: `act_${tool.toolId.replace(/^tool_/, "")}`,
      risk: tool.risk,
      confirmationMode: ELEVATED_RISKS.has(tool.risk) ? "approval_required" : "none",
    },
    requiredScopes: tool.requiredScopes,
    approval: input.approval,
    threatSignals: input.threatSignals,
    transport: input.transport,
    secretRefs: input.secretRefs,
  };
}

function finalizeExecution(input) {
  const trace = input.observability.trace(`tool.${input.status}`, {
    traceId: makeId("trc", input.runId, input.toolId),
    runId: input.runId,
    kind: "tool",
    status: input.status === "completed" ? "ok" : "error",
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    auditRef: input.auditEvent.auditId,
    attributes: {
      executionId: input.executionId,
      toolId: input.toolId,
      adapterId: input.adapterId,
      status: input.status,
      input: input.inputRedaction.value,
      result: input.resultRedaction.value,
      error: input.error,
    },
  });
  const redactedFields = [...input.inputRedaction.paths.map((path) => path.replace("$", "$.input")), ...input.resultRedaction.paths.map((path) => path.replace("$", "$.result"))];
  const evidenceRef = input.policyDecision.evidenceRef ?? makeId("ev", input.runId, input.toolId);
  const artifact = input.artifactStore.write({
    artifactId: makeId("art", input.runId, input.toolId, input.status),
    kind: input.status === "completed" ? "report" : "evidence",
    title: `Tool execution ${input.status}: ${input.toolId}`,
    runId: input.runId,
    sourceRepo: "jami-harness",
    sourceCommit: "working-tree",
    sourceRef: "refs/heads/main",
    evidenceRef,
    traceRef: trace.traceId,
    auditRefs: [input.auditEvent.auditId],
    payload: {
      executionId: input.executionId,
      toolId: input.toolId,
      adapterId: input.adapterId,
      status: input.status,
      input: input.inputRedaction.value,
      result: input.resultRedaction.value,
      error: input.error,
    },
  });
  const execution = {
    schemaVersion: SCHEMA_VERSION,
    executionId: input.executionId,
    runId: input.runId,
    toolId: input.toolId,
    adapterId: input.adapterId,
    status: input.status,
    policyDecisionRef: input.policyDecision.decisionId,
    auditRef: input.auditEvent.auditId,
    traceRef: trace.traceId,
    evidenceRef,
    artifactRef: artifact.artifactId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    timeoutMs: input.timeoutMs,
    capabilityManifestRef: input.capabilityManifestRef,
    redaction: {
      inputPolicy: input.inputRedaction.paths.length > 0 ? "redacted" : "none",
      resultPolicy: input.status === "completed"
        ? input.resultRedaction.paths.length > 0 ? "redacted" : "none"
        : "omitted",
      redactedFields,
    },
    error: input.error,
  };
  const evidence = input.observability.exportEvidencePacket({
    runId: input.runId,
    evidenceId: evidenceRef,
    subject: `Tool execution evidence: ${input.toolId}`,
    commands: [{
      command: `tool.execute ${input.toolId}`,
      status: input.status === "completed" ? "passed" : "failed",
      recordedAt: input.endedAt,
      evidenceRef,
    }],
    acceptedContracts: [
      { name: "toolExecution", version: SCHEMA_VERSION },
      { name: "policyDecision", version: SCHEMA_VERSION },
      { name: "auditEvent", version: SCHEMA_VERSION },
      { name: "traceEvent", version: SCHEMA_VERSION },
      { name: "artifactRecord", version: SCHEMA_VERSION },
      { name: "evidencePacket", version: SCHEMA_VERSION },
    ],
  });

  return {
    executable: input.status === "completed",
    status: input.status,
    execution,
    policyDecision: input.policyDecision,
    auditEvent: input.auditEvent,
    trace,
    artifact,
    evidence: evidence.packet,
  };
}

function auditForPolicyDecision({ decision, runId, actor, projectId, environment, toolId, now }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    auditId: decision.auditRef,
    runId,
    actorId: actor.actorId,
    projectId,
    environment,
    eventType: decision.decision === "allow" ? "policy.decision" : "tool.denied",
    outcome: decision.decision,
    policyDecisionRef: decision.decisionId,
    evidenceRef: decision.evidenceRef,
    approvalRef: decision.approvalRef,
    occurredAt: decision.decidedAt ?? now().toISOString(),
    redactionMode: decision.decision === "allow" ? "redacted" : "redacted",
    summary: `tool ${toolId}: ${decision.reasons.join("; ")}`,
  };
}

function denyDecision({ runId, actor, projectId, environment, toolId, reason, now }) {
  const decisionId = makeId("pol", runId, toolId, "deny");
  return {
    schemaVersion: SCHEMA_VERSION,
    decisionId,
    runId,
    actorId: actor.actorId,
    projectId,
    environment,
    decision: "deny",
    risk: "unknown",
    requestedScopes: [],
    matchedScopes: [],
    reasons: [reason],
    auditRef: makeId("aud", runId, toolId, "deny"),
    evidenceRef: makeId("ev", runId, toolId, "deny"),
    redactions: [],
    decidedAt: now().toISOString(),
  };
}

function auditForDecision({ runId, actor, projectId, environment, toolId, outcome, reason, now }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    auditId: makeId("aud", runId, toolId, outcome),
    runId,
    actorId: actor.actorId,
    projectId,
    environment,
    eventType: "tool.denied",
    outcome,
    evidenceRef: makeId("ev", runId, toolId, outcome),
    occurredAt: now().toISOString(),
    redactionMode: "redacted",
    summary: reason,
  };
}

function capabilityManifestForTool(tool, adapterId, support) {
  if (adapterId === "adapter_function") {
    return functionCapabilityManifest({ requiredScopes: tool.requiredScopes ?? [], support });
  }
  if (adapterId === "adapter_mcp") {
    return mcpCapabilityManifest({ requiredScopes: tool.requiredScopes ?? [], sourceLock: MCP_SOURCE_LOCK, support });
  }
  const adapter = TOOL_ADAPTER_CATALOG.find((item) => item.adapterId === adapterId);
  if (adapter?.support === "unsupported") {
    return unsupportedCapabilityManifest(adapter, { requiredScopes: tool.requiredScopes ?? [] });
  }
  return genericCapabilityManifest({ adapterId, requiredScopes: tool.requiredScopes ?? [], support });
}

function functionCapabilityManifest({ requiredScopes = [], support = "supported" } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    capabilityId: "cap_function_tool_gateway",
    ownerPackage: "@jami-studio/harness-tools",
    capabilityClass: "adapter",
    features: [
      { featureId: "registry", support: "supported", notes: "Tool metadata is registered through the harness registry." },
      { featureId: "policy_gate", support: "supported", notes: "Policy decision is required before handler invocation." },
      { featureId: "execution_envelope", support: support === "supported" ? "supported" : "unsupported", notes: "Tool output is normalized into trace, audit, evidence, and artifact records." },
      { featureId: "function.local_handler", support, notes: "First-party local function handlers execute only through the harness policy-gated envelope." },
      { featureId: "streaming", support: "unsupported", notes: "Streaming is not implemented in this foundation pass." },
      { featureId: "cancellation", support: "supported", notes: "AbortSignal cancellation is represented in execution status." },
      { featureId: "resumability", support: "unsupported", notes: "Checkpoint/resume store is not implemented yet." },
      { featureId: "auth_model", support: "requires_adapter", notes: "Auth is represented by secret refs and policy scopes; protocol auth adapters are not implemented." },
    ],
    requiredScopes,
    failureModes: [
      { mode: "policy_denied", observableAs: "audit_event" },
      { mode: "adapter_unsupported", observableAs: "typed_result" },
      { mode: "timeout_or_cancelled", observableAs: "trace_event" },
      { mode: "redacted_payload", observableAs: "evidence_packet" },
    ],
    replacementCompatibility: {
      portId: "harness.tools.adapter",
      contractVersion: SCHEMA_VERSION,
      mustPreserve: ["policy", "audit", "artifact", "evidence", "redaction"],
    },
  };
}

function genericCapabilityManifest({ adapterId, requiredScopes = [], support = "unsupported" }) {
  const adapterName = adapterId.replace(/^adapter_/, "");
  return {
    schemaVersion: SCHEMA_VERSION,
    capabilityId: `cap_${adapterName}_tool_gateway`,
    ownerPackage: "@jami-studio/harness-tools",
    capabilityClass: "adapter",
    features: [
      { featureId: "registry", support: "supported", notes: "Tool metadata is registered through the harness registry." },
      { featureId: "policy_gate", support: "supported", notes: "Policy decision is required before handler invocation." },
      { featureId: "execution_envelope", support: support === "supported" ? "supported" : "unsupported", notes: "Tool output is normalized into trace, audit, evidence, and artifact records." },
      { featureId: "streaming", support: "unsupported", notes: "Streaming is not implemented in this foundation pass." },
      { featureId: "cancellation", support: support === "supported" ? "supported" : "unsupported", notes: "Cancellation is supported only for executable local adapters." },
      { featureId: "resumability", support: "unsupported", notes: "Checkpoint/resume store is not implemented yet." },
      { featureId: "auth_model", support: "requires_adapter", notes: "Auth is represented by secret refs and policy scopes; protocol auth adapters are not implemented." },
    ],
    requiredScopes,
    failureModes: [
      { mode: "policy_denied", observableAs: "audit_event" },
      { mode: "adapter_unsupported", observableAs: "typed_result" },
      { mode: "timeout_or_cancelled", observableAs: "trace_event" },
      { mode: "redacted_payload", observableAs: "evidence_packet" },
    ],
    replacementCompatibility: {
      portId: "harness.tools.adapter",
      contractVersion: SCHEMA_VERSION,
      mustPreserve: ["policy", "audit", "artifact", "evidence", "redaction"],
    },
  };
}

function mcpCapabilityManifest({ requiredScopes = [], sourceLock = MCP_SOURCE_LOCK, support = "supported" } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    capabilityId: "cap_mcp_tool_gateway",
    ownerPackage: "@jami-studio/harness-tools",
    capabilityClass: "adapter",
    features: [
      { featureId: "source_lock.mcp_spec", support: "supported", notes: `Official MCP specification ${sourceLock.protocolVersion} is locked in repo-local evidence.` },
      { featureId: "mcp.trusted_in_process_fixture", support, notes: "Trusted fixture server supports initialize, tools/list, and tools/call mapping into the harness execution envelope." },
      { featureId: "mcp.tool_discovery", support, notes: "Tool metadata is validated before registration." },
      { featureId: "mcp.tool_call", support, notes: "Tool calls execute only after harness policy allows the mapped tool." },
      { featureId: "mcp.stdio_client", support: "unsupported", notes: "Subprocess stdio transport is not implemented in this pass." },
      { featureId: "mcp.streamable_http_client", support: "unsupported", notes: "Remote Streamable HTTP client, SSE, polling, and resumability are not implemented in this pass." },
      { featureId: "mcp.streamable_http_controls", support: "supported", notes: "Origin, visible-ASCII session id, protocol-version, and localhost-binding guards are represented as fail-closed validation." },
      { featureId: "mcp.oauth", support: "unsupported", notes: "OAuth discovery, PKCE, Client ID Metadata Documents, dynamic registration, and token validation are not implemented." },
      { featureId: "mcp.resources_prompts_roots_sampling_elicitation", support: "unsupported", notes: "This pass maps only server tools." },
      { featureId: "policy_gate", support: "supported", notes: "MCP calls use the same policy, audit, trace, evidence, artifact, and redaction envelope as function tools." },
      { featureId: "resumability", support: "unsupported", notes: "Checkpoint/resume store and MCP SSE redelivery are not implemented." },
    ],
    requiredScopes,
    failureModes: [
      { mode: "policy_denied", observableAs: "audit_event" },
      { mode: "adapter_unsupported", observableAs: "typed_result" },
      { mode: "metadata_poisoning", observableAs: "typed_result" },
      { mode: "invalid_origin_or_session", observableAs: "typed_result" },
      { mode: "redacted_payload", observableAs: "evidence_packet" },
    ],
    replacementCompatibility: {
      portId: "harness.tools.adapter.mcp",
      contractVersion: SCHEMA_VERSION,
      mustPreserve: ["policy", "audit", "artifact", "evidence", "redaction"],
    },
  };
}

function unsupportedCapabilityManifest(adapter, options = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    capabilityId: capabilityIdForAdapter(adapter),
    ownerPackage: "@jami-studio/harness-tools",
    capabilityClass: "adapter",
    features: [
      { featureId: `${adapter.shortId}.source_lock`, support: "unsupported", notes: adapter.sourceLock.requiredBefore ?? "Repo-local current source-lock evidence is required before implementation." },
      { featureId: `${adapter.shortId}.dry_run`, support: "supported", notes: "Dry-run inspection records typed unsupported evidence without invoking an external protocol, process, browser, code runner, provider, or agent." },
      { featureId: `${adapter.shortId}.execute`, support: "unsupported", notes: adapter.unsupportedReason },
      { featureId: "policy_gate", support: "supported", notes: "Unsupported requests still fail through typed policy/audit/evidence records." },
      { featureId: "streaming", support: "unsupported", notes: "No protocol streaming support is claimed." },
      { featureId: "cancellation", support: "unsupported", notes: "No protocol cancellation support is claimed." },
      { featureId: "resumability", support: "unsupported", notes: "No protocol resume support is claimed." },
    ],
    requiredScopes: options.requiredScopes ?? [],
    failureModes: [
      { mode: "adapter_unsupported", observableAs: "typed_result" },
      { mode: "source_lock_missing", observableAs: "evidence_packet" },
      { mode: "external_side_effect_blocked", observableAs: "audit_event" },
    ],
    replacementCompatibility: {
      portId: `harness.tools.adapter.${adapter.shortId}`,
      contractVersion: SCHEMA_VERSION,
      mustPreserve: ["policy", "audit", "artifact", "evidence", "redaction"],
    },
  };
}

function capabilityIdForAdapter(adapter) {
  return `cap_${adapter.shortId}_tool_gateway`;
}

function adapterForId(adapterId) {
  const normalized = String(adapterId ?? "").startsWith("adapter_") ? String(adapterId) : `adapter_${adapterId}`;
  const adapter = TOOL_ADAPTER_CATALOG.find((item) => item.adapterId === normalized);
  if (!adapter) {
    throw new ToolGatewayError("unknown_adapter", `unknown tool adapter: ${String(adapterId)}`);
  }
  return adapter;
}

function missingSourceLock(sourceId, requiredBefore) {
  return {
    sourceId,
    status: "missing",
    evidenceDate: "unavailable",
    provenance: "No repo-local source-lock evidence is recorded for this adapter surface.",
    requiredBefore,
    refreshTrigger: "Before any executable adapter implementation or public support claim.",
  };
}

async function mcpRequest(server, method, params) {
  const id = makeId("mcp", method);
  const response = await server.request({ jsonrpc: "2.0", id, method, params });
  if (!response || response.jsonrpc !== "2.0") {
    throw new ToolGatewayError("invalid_mcp_response", "MCP server returned an invalid JSON-RPC response");
  }
  if (response.error) {
    throw new ToolGatewayError("mcp_request_failed", response.error.message ?? "MCP request failed");
  }
  return response.result ?? {};
}

function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function assertMcpSourceLock(sourceLock) {
  if (sourceLock.protocolVersion !== MCP_PROTOCOL_VERSION) {
    throw new ToolGatewayError("invalid_source_lock", `MCP source-lock protocolVersion must be ${MCP_PROTOCOL_VERSION}`);
  }
  if (!Array.isArray(sourceLock.officialUrls) || sourceLock.officialUrls.length < 5) {
    throw new ToolGatewayError("invalid_source_lock", "MCP source-lock must include official specification, transport, tools, authorization, and changelog URLs");
  }
  if (!sourceLock.officialUrls.every((url) => typeof url === "string" && url.startsWith("https://modelcontextprotocol.io/specification/2025-11-25"))) {
    throw new ToolGatewayError("invalid_source_lock", "MCP source-lock URLs must be official 2025-11-25 specification URLs");
  }
}

function assertMcpToolMetadata(tool) {
  if (!tool || typeof tool !== "object") {
    throw new ToolGatewayError("invalid_mcp_tool_metadata", "MCP tool metadata must be an object");
  }
  if (!MCP_TOOL_NAME_PATTERN.test(tool.name ?? "")) {
    throw new ToolGatewayError("invalid_mcp_tool_metadata", "MCP tool names must be 1-128 ASCII letters, digits, underscore, hyphen, or dot");
  }
  if (hasPoisonedMcpMetadata(tool)) {
    throw new ToolGatewayError("mcp_metadata_poisoning", "MCP tool metadata contains policy-bypass or secret-exfiltration language");
  }
  if (!tool.inputSchema || typeof tool.inputSchema !== "object" || Array.isArray(tool.inputSchema)) {
    throw new ToolGatewayError("invalid_mcp_tool_metadata", "MCP tool inputSchema must be an object");
  }
  if (tool.inputSchema.type !== undefined && tool.inputSchema.type !== "object") {
    throw new ToolGatewayError("invalid_mcp_tool_metadata", "MCP tool inputSchema must describe an object input");
  }
}

function hasPoisonedMcpMetadata(value) {
  if (typeof value === "string") return MCP_METADATA_POISON_PATTERN.test(value);
  if (Array.isArray(value)) return value.some((child) => hasPoisonedMcpMetadata(child));
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => {
    if (/authorization|cookie|credential|password|secret|session|token/i.test(key)) return true;
    if (key === "annotations" && hasPoisonedMcpMetadata(child)) return true;
    return ["name", "title", "description", "inputSchema"].includes(key) && hasPoisonedMcpMetadata(child);
  });
}

function toHarnessToolId(name) {
  return `tool_mcp_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64)}`;
}

function isVisibleAscii(value) {
  return typeof value === "string" && /^[\x21-\x7E]+$/.test(value);
}

function normalizeActor(actor = {}) {
  return {
    actorId: ACTOR_ID_PATTERN.test(actor.actorId ?? "") ? actor.actorId : "actor_unknown",
    scopes: Array.isArray(actor.scopes) ? actor.scopes : [],
  };
}

function normalizeId(prefix, value, fallback) {
  const pattern = prefix === "run" ? RUN_ID_PATTERN : PROJECT_ID_PATTERN;
  if (value === undefined) return fallback;
  return typeof value === "string" && pattern.test(value) ? value : `${prefix}_unknown`;
}

function redactObject(value, path = "$") {
  if (value === null || typeof value !== "object") return { value, paths: [] };
  const paths = [];
  return { value: redactWalk(value, path, paths), paths };
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
    if (SENSITIVE_FIELD_PATTERN.test(key)) {
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
    .replace(/\b(api[_-]?key|token|secret|password|credential|authorization|cookie|session)\b\s*[:=]\s*[^,\s;]+/gi, "$1=[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]");
}

function assertPort(name, port, methods) {
  if (!port || typeof port !== "object") {
    throw new ToolGatewayError("invalid_port", `${name} must be an object`);
  }
  const missing = methods.filter((method) => typeof port[method] !== "function");
  if (missing.length > 0) {
    throw new ToolGatewayError("invalid_port", `${name} is missing methods: ${missing.join(", ")}`);
  }
}

function makeId(prefix, ...parts) {
  const body = parts
    .filter(Boolean)
    .join("_")
    .toLowerCase()
    .replace(/^(run|tool|adapter|act|pol|aud|ev|trc|art|tex)_/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  if (body) return `${prefix}_${body}`;
  return `${prefix}_${createHash("sha256").update(String(Date.now())).digest("hex").slice(0, 12)}`;
}
