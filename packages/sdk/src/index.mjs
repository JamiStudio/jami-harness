import { createInMemoryArtifactStore, toArtifactView } from "../../artifacts/src/index.mjs";
import {
  createContextAssembler,
  createInMemoryMemoryPort,
  createMemorySearchAdapter,
  createNoopMemoryPort,
  createNoopSearchAdapter,
} from "../../memory/src/index.mjs";
import { createRunObservability } from "../../observability/src/index.mjs";
import { createDefaultPolicyEngine } from "../../policy/src/index.mjs";
import { createDeterministicProvider } from "../../provider-local/src/index.mjs";
import { createRunLifecycleKernel } from "../../runtime/src/index.mjs";
import { createInMemoryCheckpointStore } from "../../store-local/src/index.mjs";
import {
  createFunctionTool,
  createToolGateway,
  createToolRegistry,
  listToolAdapterCapabilities,
  listToolAdapterSourceLocks,
} from "../../tools/src/index.mjs";

const SCHEMA_VERSION = "2026-06-09";
const ID_PATTERNS = {
  artifact: /^art_[a-z0-9][a-z0-9_-]*$/,
  evidence: /^ev_[a-z0-9][a-z0-9_-]*$/,
  project: /^proj_[a-z0-9][a-z0-9_-]*$/,
  run: /^run_[a-z0-9][a-z0-9_-]*$/,
};

export class HarnessInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HarnessInputError";
    this.code = code;
  }
}

export function createHarness(options = {}) {
  const now = options.now ?? (() => new Date());
  const artifactStore = options.artifactStore ?? createInMemoryArtifactStore({ now });
  assertPort("artifactStore", artifactStore, ["write", "read", "list"]);
  const observability = options.observability ?? createRunObservability({ now, artifactStore });
  assertPort("observability", observability, ["trace", "exportEvidencePacket"]);
  const memory = options.memory ?? (options.disableMemory ? createNoopMemoryPort() : createInMemoryMemoryPort({ now }));
  assertCapabilities("memory", memory);
  const search = options.search ?? (memory.capabilities?.searchable ? createMemorySearchAdapter(memory) : createNoopSearchAdapter());
  assertPort("search", search, ["search"]);
  const context = options.context ?? createContextAssembler({ search });
  assertPort("context", context, ["assemble"]);
  const checkpointStore = options.checkpointStore ?? createInMemoryCheckpointStore({ now });
  assertPort("checkpointStore", checkpointStore, ["writeCheckpoint", "readCheckpoint", "resume", "writeApproval", "listApprovals"]);
  const policyEngine = options.policyEngine ?? createDefaultPolicyEngine({ now });
  assertPort("policyEngine", policyEngine, ["evaluate"]);
  const provider = options.provider ?? createDeterministicProvider({ now });
  assertPort("provider", provider, ["generate"]);
  assertCapabilities("provider", provider);
  const docsOutput = options.docsOutput ?? createUnavailableModule("docsOutput", "repo-level docs generation exists through pnpm docs:generate; SDK docs-output injection is not wired yet");
  const tools = options.tools ?? createToolRegistry();
  ensureDefaultLocalTools(tools);
  const toolGateway = options.toolGateway ?? createToolGateway({ registry: tools, artifactStore, observability, policyEngine, now });
  assertPort("toolGateway", toolGateway, ["execute"]);
  const toolAdapterManifests = typeof tools.manifests === "function" ? tools.manifests() : [];
  const toolAdapters = listToolAdapterCapabilities();
  const sourceLocks = options.sourceLocks ?? listToolAdapterSourceLocks();

  const modules = {
    runtime: capability("runtime", "core_invariant", "default", true, [
      "run lifecycle events",
      "policy-gated action references",
      "artifact view emission",
    ]),
    policy: capability("policy", "core_invariant", "default", true, [
      "default-deny decisions",
      "approval validation",
      "audit event emission",
    ]),
    artifacts: capability("artifacts", "core_invariant", moduleMode(artifactStore), true, [
      "artifact provenance records",
      "artifact view projection",
    ]),
    observability: capability("observability", "core_invariant", "default", true, [
      "runtime event sink",
      "audit event sink",
      "local evidence packet export",
    ]),
    memory: capability("memory", "replaceable_module", moduleMode(memory), memory.capabilities?.readable === true, [
      "permission-filtered local search",
      "citation freshness",
      "deterministic context packs",
    ], memory.capabilities?.mode === "noop" ? ["memory module disabled"] : []),
    search: capability("search", "replaceable_module", moduleMode(search), search.capabilities?.searchable === true, [
      "replaceable retrieval adapter",
      "permission-preserving local memory search",
    ], search.capabilities?.searchable === false ? ["search adapter disabled"] : []),
    context: capability("context", "replaceable_module", moduleMode(context), true, [
      "deterministic context assembly",
      "token budget drops",
      "citation-preserving inclusion reasons",
    ]),
    checkpointStore: capability("checkpointStore", "replaceable_module", moduleMode(checkpointStore), checkpointStore.capabilities?.checkpoint === true, [
      "checkpoint write/read",
      "resume status",
      "approval record storage",
      "redacted replay hash",
    ], checkpointStore.capabilities?.durable ? [] : ["checkpoint store is in-memory and not durable"]),
    provider: capability("provider", "replaceable_module", moduleMode(provider), provider.capabilities?.provider === true, [
      "local deterministic provider workflow",
      "model replacement port",
      "fail-closed external provider routes",
      "recoverable fail-once fixture",
    ], provider.capabilities?.provider === true ? [] : ["provider route is unsupported"]),
    tools: capability("tools", "replaceable_module", moduleMode(tools), true, [
      "tool registry",
      "policy-gated execution envelope",
      "function tool adapter",
      "trusted MCP fixture adapter",
      "unsupported adapter dry-run evidence",
      "adapter source-lock inspection",
    ], tools.reason ? [tools.reason] : []),
    docsOutput: capability("docsOutput", "optional_surface", moduleMode(docsOutput), false, [], [docsOutput.reason]),
  };

  return {
    modules,
    artifactStore,
    observability,
    memory,

    createRun(input = {}) {
      return createSdkRun({
        ...input,
        now,
        artifactStore,
        observability,
        memory,
        context,
        checkpointStore,
        policyEngine,
        provider,
        toolGateway,
      });
    },

    async run(input = {}) {
      const run = this.createRun(input);
      return run.execute(input);
    },

    readArtifact(artifactId) {
      return artifactStore.read(artifactId);
    },

    readArtifacts() {
      return artifactStore.list();
    },

    readTraces() {
      return observability.traces;
    },

    resume(runId) {
      return checkpointStore.resume(runId);
    },

    approve(input = {}) {
      return checkpointStore.writeApproval(input);
    },

    inspect() {
      return {
        schemaVersion: SCHEMA_VERSION,
        generatedAt: now().toISOString(),
        modules: Object.values(modules),
        sourceLocks,
        toolAdapters,
        toolAdapterManifests,
        boundaries: {
          toolGateway: "foundation_only",
          hostedControlPlane: "not_implemented",
          workbench: "not_implemented",
          docsGeneration: "repo_generator_available_sdk_output_not_wired",
          checkpointStore: checkpointStore.capabilities?.durable ? "durable_local" : "memory_only",
          providerRuntime: provider.capabilities?.provider === true ? "local_deterministic_only" : "unsupported",
          hostedProviders: "not_implemented",
        },
      };
    },
  };
}

function createSdkRun({ now, artifactStore, observability, memory, context, checkpointStore, policyEngine, provider, toolGateway, ...input }) {
  const runId = normalizeId("run", input.runId, "run_local");
  const actor = input.actor ?? { actorId: "actor_developer", scopes: ["repo:read", "tool:local:execute"] };
  const projectId = normalizeId("project", input.projectId, "proj_jami_harness");
  const environment = input.environment ?? "local";
  const kernel = createRunLifecycleKernel({
    now,
    runId,
    taskId: input.taskId,
    actor,
    projectId,
    environment,
    policyEngine,
    eventSink: observability.eventSink,
    auditSink: observability.auditSink,
  });

  return {
    runId,
    kernel,

    async execute(executeInput = {}) {
      const artifactId = normalizeId("artifact", executeInput.artifactId, `art_${runId.replace(/^run_/, "")}_summary`);
      const evidenceRef = normalizeId("evidence", executeInput.evidenceRef, `ev_${runId.replace(/^run_/, "")}_summary`);
      kernel.start(executeInput.message ?? "local harness run started");
      kernel.progress("capturing local evidence foundation");
      const contextPack = context.assemble({
        runId,
        projectId,
        actor,
        now,
      });
      const providerResult = await runProviderWithRecovery({
        provider,
        checkpointStore,
        artifactStore,
        observability,
        now,
        runId,
        projectId,
        environment,
        actor,
        contextPack,
        executeInput,
      });
      if (providerResult.status === "unsupported") {
        kernel.fail(providerResult.reason);
        const checkpoint = checkpointStore.writeCheckpoint({
          runId,
          status: "unsupported",
          sequence: kernel.events.length,
          events: kernel.events,
          artifacts: artifactStore.list(),
          sourceRepo: executeInput.sourceRepo ?? "jami-harness",
          sourceCommit: executeInput.sourceCommit ?? "working-tree",
          sourceRef: executeInput.sourceRef ?? "refs/heads/main",
          pendingApprovals: [],
        }).checkpoint;
        const evidence = observability.exportEvidencePacket({
          runId,
          evidenceId: providerResult.evidenceRef,
          subject: "Unsupported provider route evidence",
          repo: executeInput.sourceRepo ?? "jami-harness",
          commit: executeInput.sourceCommit ?? "working-tree",
          ref: executeInput.sourceRef ?? "refs/heads/main",
          commands: [{
            command: `provider.generate ${providerResult.providerId}`,
            status: "failed",
            recordedAt: providerResult.generatedAt,
            evidenceRef: providerResult.evidenceRef,
          }],
          acceptedContracts: [
            { name: "runEvent", version: SCHEMA_VERSION },
            { name: "traceEvent", version: SCHEMA_VERSION },
            { name: "artifactRecord", version: SCHEMA_VERSION },
            { name: "evidencePacket", version: SCHEMA_VERSION },
          ],
        });
        return {
          schemaVersion: SCHEMA_VERSION,
          runId,
          status: "unsupported",
          reason: providerResult.reason,
          providerResult,
          events: kernel.events,
          checkpoint,
          contextPack,
          evidence: evidence.packet,
          evidenceArtifact: evidence.artifact,
          traces: observability.traces,
          audits: observability.audits,
        };
      }

      const toolExecutions = [];
      for (const toolCall of providerResult.toolCalls ?? []) {
        const execution = await toolGateway.execute({
          runId,
          projectId,
          environment,
          actor,
          toolId: toolCall.toolId,
          input: toolCall.input,
        });
        toolExecutions.push(execution);
        if (execution.status !== "completed") {
          kernel.fail(`tool execution failed: ${execution.status}`);
          break;
        }
      }
      const trace = observability.trace("sdk.run", {
        runId,
        kind: "run",
        status: toolExecutions.every((execution) => execution.status === "completed") ? "ok" : "error",
        attributes: {
          projectId,
          environment,
          providerId: providerResult.providerId,
          providerStatus: providerResult.status,
          memoryMode: memory.capabilities?.mode ?? "unknown",
          contextHash: contextPack.deterministicHash,
          toolExecutionStatuses: toolExecutions.map((execution) => execution.status),
        },
      });
      const artifact = artifactStore.write({
        artifactId,
        kind: "report",
        title: executeInput.title ?? "Local harness run summary",
        runId,
        sourceRepo: executeInput.sourceRepo ?? "jami-harness",
        sourceCommit: executeInput.sourceCommit ?? "working-tree",
        sourceRef: executeInput.sourceRef ?? "refs/heads/main",
        evidenceRef,
        traceRef: trace.traceId,
        payload: {
          runId,
          status: "completed",
          modules: {
            memory: memory.capabilities?.mode ?? "unknown",
            context: context.capabilities?.mode ?? "unknown",
            artifacts: artifactStore.capabilities?.mode ?? "unknown",
            provider: provider.capabilities?.mode ?? "unknown",
            tools: toolGateway.registry?.capabilities?.().mode ?? "unknown",
          },
          provider: {
            providerRunId: providerResult.providerRunId,
            providerId: providerResult.providerId,
            status: providerResult.status,
            output: providerResult.output,
          },
          tools: toolExecutions.map(({ execution }) => ({
            executionId: execution.executionId,
            toolId: execution.toolId,
            status: execution.status,
            artifactRef: execution.artifactRef,
            evidenceRef: execution.evidenceRef,
          })),
          context: {
            contextPackId: contextPack.contextPackId,
            deterministicHash: contextPack.deterministicHash,
            itemCount: contextPack.items.length,
            droppedItemCount: contextPack.droppedItems.length,
          },
        },
      });
      const artifactView = toArtifactView(artifact);
      const artifactResult = kernel.emitArtifactView(artifactView);
      kernel.complete("local harness run completed");
      const checkpoint = checkpointStore.writeCheckpoint({
        runId,
        status: "completed",
        sequence: kernel.events.length,
        events: kernel.events,
        artifacts: artifactStore.list(),
        sourceRepo: executeInput.sourceRepo ?? "jami-harness",
        sourceCommit: executeInput.sourceCommit ?? "working-tree",
        sourceRef: executeInput.sourceRef ?? "refs/heads/main",
      }).checkpoint;
      const evidence = observability.exportEvidencePacket({
        runId,
        subject: executeInput.subject ?? "Local harness SDK evidence",
        repo: executeInput.sourceRepo ?? "jami-harness",
        commit: executeInput.sourceCommit ?? "working-tree",
        ref: executeInput.sourceRef ?? "refs/heads/main",
        commands: executeInput.commands ?? [
          { command: `provider.generate ${providerResult.providerId}`, status: "passed", recordedAt: providerResult.generatedAt, evidenceRef: providerResult.evidenceRef },
          ...toolExecutions.map(({ execution }) => ({
            command: `tool.execute ${execution.toolId}`,
            status: execution.status === "completed" ? "passed" : "failed",
            recordedAt: execution.endedAt,
            evidenceRef: execution.evidenceRef,
          })),
        ],
      });

      return {
        schemaVersion: SCHEMA_VERSION,
        runId,
        status: toolExecutions.every((execution) => execution.status === "completed") ? "completed" : "failed",
        events: kernel.events,
        checkpoint,
        contextPack,
        providerResult,
        toolExecutions,
        artifact,
        artifactView: artifactResult.artifactView,
        evidence: evidence.packet,
        evidenceArtifact: evidence.artifact,
        traces: observability.traces,
        audits: observability.audits,
      };
    },
  };
}

async function runProviderWithRecovery({ provider, checkpointStore, artifactStore, observability, runId, projectId, environment, actor, contextPack, executeInput }) {
  const baseInput = {
    runId,
    providerId: executeInput.providerId,
    workflowId: executeInput.workflowId,
    failureMode: executeInput.providerFailureMode,
    instruction: executeInput.instruction,
    contextHash: contextPack.deterministicHash,
    memoryItemCount: contextPack.items.length,
  };
  const first = await provider.generate(baseInput);
  recordProviderTraceAndArtifact({ providerResult: first, artifactStore, observability, runId, projectId, environment, actor, executeInput });
  if (!first.retryable) return first;

  checkpointStore.writeCheckpoint({
    runId,
    status: "failed_recoverable",
    sequence: 0,
    events: [],
    artifacts: artifactStore.list(),
    sourceRepo: executeInput.sourceRepo ?? "jami-harness",
    sourceCommit: executeInput.sourceCommit ?? "working-tree",
    sourceRef: executeInput.sourceRef ?? "refs/heads/main",
    pendingApprovals: [],
  });
  const second = await provider.generate(baseInput);
  recordProviderTraceAndArtifact({ providerResult: second, artifactStore, observability, runId, projectId, environment, actor, executeInput });
  return second;
}

function recordProviderTraceAndArtifact({ providerResult, artifactStore, observability, runId, projectId, environment, actor, executeInput }) {
  const trace = observability.trace(providerResult.traceName, {
    runId,
    kind: "provider",
    status: providerResult.status === "completed" ? "ok" : "error",
    attributes: {
      projectId,
      environment,
      actorId: actor.actorId,
      providerId: providerResult.providerId,
      providerStatus: providerResult.status,
      reason: providerResult.reason,
      output: providerResult.output,
      toolCalls: providerResult.toolCalls,
    },
  });
  artifactStore.write({
    artifactId: `art_${providerResult.providerRunId.replace(/^prv_/, "")}`,
    kind: providerResult.status === "completed" ? "report" : "evidence",
    title: `Provider execution ${providerResult.status}: ${providerResult.providerId}`,
    runId,
    sourceRepo: executeInput.sourceRepo ?? "jami-harness",
    sourceCommit: executeInput.sourceCommit ?? "working-tree",
    sourceRef: executeInput.sourceRef ?? "refs/heads/main",
    evidenceRef: providerResult.evidenceRef,
    traceRef: trace.traceId,
    payload: {
      providerRunId: providerResult.providerRunId,
      providerId: providerResult.providerId,
      status: providerResult.status,
      reason: providerResult.reason,
      output: providerResult.output,
      toolCalls: providerResult.toolCalls,
    },
  });
}

function capability(name, capabilityClass, mode, available, features = [], unavailableReasons = []) {
  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    capabilityClass,
    mode,
    available,
    replaceable: capabilityClass !== "core_invariant",
    features,
    unavailableReasons: unavailableReasons.filter(Boolean),
  };
}

function createUnavailableModule(name, reason) {
  return { name, capabilities: { mode: "absent" }, reason };
}

function ensureDefaultLocalTools(tools) {
  if (typeof tools.get !== "function" || typeof tools.register !== "function") return;
  if (tools.get("tool_local_echo")) return;
  tools.register(createFunctionTool({
    toolId: "tool_local_echo",
    label: "Local echo evidence tool",
    risk: "read",
    sideEffect: "none",
    requiredScopes: ["repo:read"],
    timeoutMs: 5_000,
    resultShape: "json",
    artifactKind: "report",
    handler(input = {}) {
      return {
        ok: true,
        message: input.message ?? "local deterministic provider workflow",
        contextHash: input.contextHash,
        memoryItemCount: input.memoryItemCount ?? 0,
      };
    },
  }));
}

function moduleMode(module) {
  return module?.capabilities?.mode ?? "custom";
}

function normalizeId(kind, value, fallback) {
  if (value === undefined) return fallback;
  const pattern = ID_PATTERNS[kind];
  if (typeof value === "string" && pattern.test(value)) return value;
  throw new HarnessInputError(
    "invalid_identifier",
    `${kind} id must match ${pattern.source}`,
  );
}

function assertPort(name, port, methods) {
  if (!port || typeof port !== "object") {
    throw new HarnessInputError("invalid_module", `${name} module must be an object`);
  }
  const missing = methods.filter((method) => typeof port[method] !== "function");
  if (missing.length > 0) {
    throw new HarnessInputError("invalid_module", `${name} module is missing required methods: ${missing.join(", ")}`);
  }
}

function assertCapabilities(name, module) {
  if (!module?.capabilities || typeof module.capabilities !== "object") {
    throw new HarnessInputError("invalid_module", `${name} module must expose a capabilities object`);
  }
}
