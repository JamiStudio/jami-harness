import { createInMemoryArtifactStore, toArtifactView } from "../../artifacts/src/index.mjs";
import { createInMemoryMemoryPort, createNoopMemoryPort } from "../../memory/src/index.mjs";
import { createRunObservability } from "../../observability/src/index.mjs";
import { createDefaultPolicyEngine } from "../../policy/src/index.mjs";
import { createRunLifecycleKernel } from "../../runtime/src/index.mjs";
import { createToolRegistry } from "../../tools/src/index.mjs";

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
  const policyEngine = options.policyEngine ?? createDefaultPolicyEngine({ now });
  assertPort("policyEngine", policyEngine, ["evaluate"]);
  const docsOutput = options.docsOutput ?? createUnavailableModule("docsOutput", "docs generation package is not implemented yet");
  const tools = options.tools ?? createToolRegistry();
  const sourceLocks = options.sourceLocks ?? [];

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
    tools: capability("tools", "replaceable_module", moduleMode(tools), true, [
      "tool registry",
      "policy-gated execution envelope",
      "function tool adapter",
      "unsupported adapter capability manifests",
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
        policyEngine,
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

    inspect() {
      return {
        schemaVersion: SCHEMA_VERSION,
        generatedAt: now().toISOString(),
        modules: Object.values(modules),
        sourceLocks,
        boundaries: {
          providerRuntime: "not_implemented",
          toolGateway: "foundation_only",
          hostedControlPlane: "not_implemented",
          workbench: "not_implemented",
          docsGeneration: "not_implemented",
        },
      };
    },
  };
}

function createSdkRun({ now, artifactStore, observability, memory, policyEngine, ...input }) {
  const runId = normalizeId("run", input.runId, "run_local");
  const actor = input.actor ?? { actorId: "actor_developer", scopes: ["repo:read"] };
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
      const trace = observability.trace("sdk.run", {
        runId,
        kind: "run",
        status: "ok",
        attributes: {
          projectId,
          environment,
          memoryMode: memory.capabilities?.mode ?? "unknown",
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
            artifacts: artifactStore.capabilities?.mode ?? "unknown",
          },
        },
      });
      const artifactView = toArtifactView(artifact);
      const artifactResult = kernel.emitArtifactView(artifactView);
      kernel.complete("local harness run completed");
      const evidence = observability.exportEvidencePacket({
        runId,
        subject: executeInput.subject ?? "Local harness SDK evidence",
        repo: executeInput.sourceRepo ?? "jami-harness",
        commit: executeInput.sourceCommit ?? "working-tree",
        ref: executeInput.sourceRef ?? "refs/heads/main",
        commands: executeInput.commands,
      });

      return {
        schemaVersion: SCHEMA_VERSION,
        runId,
        status: "completed",
        events: kernel.events,
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
