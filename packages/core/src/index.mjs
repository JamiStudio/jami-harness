import { createInMemoryArtifactStore } from "../../artifacts/src/index.mjs";
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
import { createInMemoryCheckpointStore } from "../../store-local/src/index.mjs";
import {
  createFunctionTool,
  createToolGateway,
  createToolRegistry,
  listToolAdapterCapabilities,
  listToolAdapterSourceLocks,
} from "../../tools/src/index.mjs";

export const CORE_SCHEMA_VERSION = "2026-06-12.core-composition";

export class HarnessCoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HarnessCoreError";
    this.code = code;
  }
}

export function composeHarnessCore(options = {}) {
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

  const toolAdapters = listToolAdapterCapabilities();
  const sourceLocks = validateAdapterSourceLocks(options.sourceLocks ?? listToolAdapterSourceLocks(), toolAdapters);
  const toolAdapterManifests = typeof tools.manifests === "function" ? tools.manifests() : [];
  const modules = buildCoreModules({
    artifactStore,
    observability,
    memory,
    search,
    context,
    checkpointStore,
    provider,
    tools,
    docsOutput,
  });
  const installPaths = buildInstallPaths(modules);

  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    now,
    artifactStore,
    observability,
    memory,
    search,
    context,
    checkpointStore,
    policyEngine,
    provider,
    docsOutput,
    tools,
    toolGateway,
    modules,
    installPaths,
    sourceLocks,
    toolAdapters,
    toolAdapterManifests,
    inspect() {
      return {
        schemaVersion: CORE_SCHEMA_VERSION,
        generatedAt: now().toISOString(),
        modules: Object.values(modules),
        installPaths,
        sourceLocks,
        toolAdapters,
        toolAdapterManifests,
        boundaries: {
          coreComposition: "package_owned_default_ports",
          toolGateway: "foundation_only",
          hostedControlPlane: "not_implemented",
          workbench: "local_static_workbench_available_hosted_unavailable",
          docsGeneration: "repo_generator_available_sdk_output_not_wired",
          checkpointStore: checkpointStore.capabilities?.durable ? "durable_local" : "memory_only",
          providerRuntime: provider.capabilities?.provider === true ? "local_deterministic_only" : "unsupported",
          hostedProviders: "not_implemented",
        },
      };
    },
  };
}

function buildCoreModules({ artifactStore, observability, memory, search, context, checkpointStore, provider, tools, docsOutput }) {
  return {
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
    observability: capability("observability", "core_invariant", moduleMode(observability), true, [
      "runtime event sink",
      "audit event sink",
      "local metric sink",
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
}

function buildInstallPaths(modules) {
  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    fullLocalHarness: {
      pathId: "full_local_source_checkout",
      status: "supported_local_source_checkout",
      packageInstallStatus: "unavailable_private_manifests",
      installCommands: [
        "pnpm install --frozen-lockfile",
        "node apps/cli/src/cli.mjs init --json",
        "node apps/cli/src/cli.mjs run --json",
        "node apps/cli/src/cli.mjs inspect --json",
      ],
      evidenceCommands: [
        "pnpm core:test",
        "pnpm sdk:test",
        "pnpm cli:test",
        "pnpm docs:generate -- --check",
        "pnpm release:readiness",
      ],
      activeModules: [
        "runtime",
        "policy",
        "artifacts",
        "observability",
        "memory",
        "search",
        "context",
        "checkpointStore",
        "provider",
        "tools",
      ].map((name) => ({
        name,
        mode: modules[name]?.mode,
        available: modules[name]?.available === true,
      })),
      unavailableReasons: [
        "Workspace package manifests remain private:true, so public npm installation is not claimed.",
        "Hosted providers, hosted stores, hosted workbench, release publishing, hosted docs, and SDK docs-output injection remain unavailable.",
        "Local static workbench generation is available through pnpm workbench:generate; it is not a hosted control plane.",
      ],
    },
    modularPaths: [
      modularPath({ pathId: "byo_memory", moduleName: "memory", sdkOption: "memory", status: "supported_port", defaultMode: modules.memory.mode, evidence: ["packages/core/test/core.test.mjs", "packages/sdk/test/sdk.test.mjs", "jami map --json"] }),
      modularPath({ pathId: "byo_context", moduleName: "context", sdkOption: "context", status: "supported_port", defaultMode: modules.context.mode, evidence: ["packages/core/test/core.test.mjs", "packages/sdk/test/sdk.test.mjs", "jami map --json"] }),
      modularPath({ pathId: "byo_search", moduleName: "search", sdkOption: "search", status: "supported_port", defaultMode: modules.search.mode, evidence: ["packages/core/test/core.test.mjs", "packages/sdk/test/sdk.test.mjs", "jami map --json"] }),
      modularPath({ pathId: "byo_store", moduleName: "checkpointStore", sdkOption: "checkpointStore", status: "supported_port", defaultMode: modules.checkpointStore.mode, evidence: ["packages/core/test/core.test.mjs", "packages/sdk/test/sdk.test.mjs", "apps/cli/test/cli.test.mjs", "jami doctor --json"] }),
      modularPath({ pathId: "byo_provider", moduleName: "provider", sdkOption: "provider", status: "supported_port_local_only", defaultMode: modules.provider.mode, evidence: ["packages/core/test/core.test.mjs", "packages/sdk/test/sdk.test.mjs", "apps/cli/test/cli.test.mjs"], unavailableReason: "Hosted provider adapters fail closed until source-lock, auth, redaction, policy, trace, and adapter fixtures land." }),
      modularPath({ pathId: "byo_policy", moduleName: "policy", sdkOption: "policyEngine", status: "supported_port", defaultMode: modules.policy.mode, evidence: ["packages/core/test/core.test.mjs", "packages/sdk/test/sdk.test.mjs", "pnpm policy:test"] }),
      modularPath({ pathId: "byo_tools", moduleName: "tools", sdkOption: "tools", status: "supported_port_current_adapters_only", defaultMode: modules.tools.mode, evidence: ["packages/core/test/core.test.mjs", "packages/sdk/test/sdk.test.mjs", "pnpm tools:test", "jami tools --json"], unavailableReason: "OpenAPI, shell, browser, code, provider-as-tool, A2A, stdio MCP, and remote MCP remain fail-closed unsupported surfaces." }),
      modularPath({ pathId: "byo_artifacts", moduleName: "artifacts", sdkOption: "artifactStore", status: "supported_port", defaultMode: modules.artifacts.mode, evidence: ["packages/core/test/core.test.mjs", "packages/sdk/test/sdk.test.mjs", "pnpm artifacts:test"] }),
      modularPath({ pathId: "byo_observability", moduleName: "observability", sdkOption: "observability", status: "supported_port", defaultMode: modules.observability.mode, evidence: ["packages/core/test/core.test.mjs", "packages/sdk/test/sdk.test.mjs", "pnpm observability:test"] }),
      modularPath({ pathId: "byo_docs_output", moduleName: "docsOutput", sdkOption: "docsOutput", status: "repo_generator_supported_sdk_output_unavailable", defaultMode: modules.docsOutput.mode, evidence: ["packages/docs/scripts/generate-docs.mjs", "pnpm docs:generate -- --check"], unavailableReason: modules.docsOutput.unavailableReasons[0] }),
    ],
    unsupportedSurfaces: [
      "public npm install",
      "hosted provider runtime",
      "hosted durable stores",
      "hosted workbench",
      "release publishing",
      "Mintlify build/publish",
      "hosted public docs",
      "release attestations",
    ],
  };
}

function modularPath({ pathId, moduleName, sdkOption, status, defaultMode, evidence, unavailableReason }) {
  return {
    pathId,
    moduleName,
    sdkOption,
    status,
    defaultMode,
    inspection: `harness.inspect().modules[name=${moduleName}]`,
    evidence,
    unavailableReason,
  };
}

function capability(name, capabilityClass, mode, available, features = [], unavailableReasons = []) {
  return {
    schemaVersion: CORE_SCHEMA_VERSION,
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

function assertPort(name, port, methods) {
  if (!port || typeof port !== "object") {
    throw new HarnessCoreError("invalid_module", `${name} module must be an object`);
  }
  const missing = methods.filter((method) => typeof port[method] !== "function");
  if (missing.length > 0) {
    throw new HarnessCoreError("invalid_module", `${name} module is missing required methods: ${missing.join(", ")}`);
  }
}

function assertCapabilities(name, module) {
  if (!module?.capabilities || typeof module.capabilities !== "object") {
    throw new HarnessCoreError("invalid_module", `${name} module must expose a capabilities object`);
  }
}

function validateAdapterSourceLocks(sourceLocks, toolAdapters) {
  if (!Array.isArray(sourceLocks)) {
    throw new HarnessCoreError("invalid_source_lock", "sourceLocks must be an array");
  }
  const adapterById = new Map(toolAdapters.map((adapter) => [adapter.adapterId, adapter]));
  const seen = new Set();
  for (const sourceLock of sourceLocks) {
    if (!sourceLock || typeof sourceLock !== "object") {
      throw new HarnessCoreError("invalid_source_lock", "sourceLocks entries must be objects");
    }
    if (!adapterById.has(sourceLock.adapterId)) {
      throw new HarnessCoreError("invalid_source_lock", `unknown source-lock adapterId: ${String(sourceLock.adapterId)}`);
    }
    if (seen.has(sourceLock.adapterId)) {
      throw new HarnessCoreError("invalid_source_lock", `duplicate source-lock adapterId: ${sourceLock.adapterId}`);
    }
    seen.add(sourceLock.adapterId);
    if (!["first_party", "locked", "missing"].includes(sourceLock.status)) {
      throw new HarnessCoreError("invalid_source_lock", `${sourceLock.adapterId} source-lock status must be first_party, locked, or missing`);
    }
    const adapter = adapterById.get(sourceLock.adapterId);
    if (adapter.support === "unsupported" && sourceLock.status !== "missing") {
      throw new HarnessCoreError("invalid_source_lock", `${sourceLock.adapterId} is unsupported and must keep source-lock status missing`);
    }
    if (adapter.support === "supported" && sourceLock.status === "missing") {
      throw new HarnessCoreError("invalid_source_lock", `${sourceLock.adapterId} is supported and must expose a first_party or locked source lock`);
    }
  }
  const missing = [...adapterById.keys()].filter((adapterId) => !seen.has(adapterId));
  if (missing.length > 0) {
    throw new HarnessCoreError("invalid_source_lock", `sourceLocks missing adapter coverage: ${missing.join(", ")}`);
  }
  return sourceLocks.map((sourceLock) => ({ ...sourceLock }));
}
