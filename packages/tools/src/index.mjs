import { createHash } from "node:crypto";
import { createInMemoryArtifactStore } from "../../artifacts/src/index.mjs";
import { createRunObservability } from "../../observability/src/index.mjs";
import { createDefaultPolicyEngine } from "../../policy/src/index.mjs";

const SCHEMA_VERSION = "2026-06-09";
const TOOL_ID_PATTERN = /^tool_[a-z0-9][a-z0-9_-]*$/;
const ADAPTER_ID_PATTERN = /^adapter_[a-z0-9][a-z0-9_-]*$/;
const RUN_ID_PATTERN = /^run_[a-z0-9][a-z0-9_-]*$/;
const ACTOR_ID_PATTERN = /^actor_[a-z0-9][a-z0-9_-]*$/;
const PROJECT_ID_PATTERN = /^proj_[a-z0-9][a-z0-9_-]*$/;
const ALLOWED_RISKS = new Set(["read", "write", "destructive", "external", "secret_adjacent"]);
const ELEVATED_RISKS = new Set(["write", "destructive", "external", "secret_adjacent"]);
const UNSUPPORTED_ADAPTER_IDS = ["mcp", "openapi", "shell", "browser", "code", "provider", "a2a"];
const SENSITIVE_FIELD_PATTERN = /secret|token|apiKey|credential|password|privatePayload|plaintext|value|authorization|cookie|session|prompt|systemPrompt|developerPrompt|userPrompt|toolMetadata|toolSchema|toolDescription/i;

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

  for (const manifest of createUnsupportedAdapterManifests()) {
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
        supportedAdapters: ["adapter_function"],
        unsupportedAdapters: UNSUPPORTED_ADAPTER_IDS.map((id) => `adapter_${id}`),
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

export function createUnsupportedAdapterManifests() {
  return UNSUPPORTED_ADAPTER_IDS.map((id) => unsupportedCapabilityManifest(id));
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
      const policyDecision = await policyEngine.evaluate(policyRequest);
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

      if (tool.support === "unsupported" || tool.adapterId !== "adapter_function") {
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
        const result = await tool.handler(input.input ?? {}, {
          signal: controller.signal,
          tool,
          runId,
          executionId,
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
          status: controller.signal.aborted ? "cancelled" : "completed",
          startedAt,
          endedAt: now().toISOString(),
          policyDecision,
          auditEvent,
          inputRedaction,
          resultRedaction,
          capabilityManifestRef: tool.capabilityManifest.capabilityId,
          timeoutMs,
          error: controller.signal.aborted ? { code: "cancelled", message: "tool execution was cancelled" } : undefined,
        });
      } catch (error) {
        const aborted = controller.signal.aborted;
        const status = aborted && error?.code === "timeout" ? "timeout" : aborted ? "cancelled" : "failed";
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
          error: {
            code: error?.code ?? status,
            message: error instanceof Error ? error.message : String(error),
          },
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

  const support = adapterId === "adapter_function" ? "supported" : "unsupported";
  if (support === "supported" && typeof tool.handler !== "function") {
    throw new ToolGatewayError("invalid_tool", "function tools must provide a handler");
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
      { featureId: "cancellation", support: "supported", notes: "AbortSignal cancellation is represented in execution status." },
      { featureId: "resumability", support: "unsupported", notes: "Checkpoint/resume store is not implemented yet." },
      { featureId: "auth_model", support: "requires_adapter", notes: "Auth is represented by secret refs and policy scopes; protocol auth adapters are not implemented." },
    ],
    requiredScopes: tool.requiredScopes ?? [],
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

function unsupportedCapabilityManifest(id) {
  return {
    schemaVersion: SCHEMA_VERSION,
    capabilityId: `cap_${id}_tool_gateway`,
    ownerPackage: "@jami-studio/harness-tools",
    capabilityClass: "adapter",
    features: [
      { featureId: `${id}_adapter`, support: "unsupported", notes: "Not implemented until repo-local current source-lock evidence is refreshed." },
      { featureId: "policy_gate", support: "supported", notes: "Unsupported requests still fail through typed policy/audit/evidence records." },
      { featureId: "streaming", support: "unsupported", notes: "No protocol streaming support is claimed." },
      { featureId: "cancellation", support: "unsupported", notes: "No protocol cancellation support is claimed." },
      { featureId: "resumability", support: "unsupported", notes: "No protocol resume support is claimed." },
    ],
    requiredScopes: [],
    failureModes: [
      { mode: "adapter_unsupported", observableAs: "typed_result" },
      { mode: "source_lock_missing", observableAs: "evidence_packet" },
    ],
    replacementCompatibility: {
      portId: `harness.tools.adapter.${id}`,
      contractVersion: SCHEMA_VERSION,
      mustPreserve: ["policy", "audit", "artifact", "evidence", "redaction"],
    },
  };
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
