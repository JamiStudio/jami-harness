import { toArtifactView } from "@jami-studio/harness-artifacts";
import { HarnessCoreError, composeHarnessCore } from "@jami-studio/harness-core";
import { createRunLifecycleKernel } from "@jami-studio/harness-runtime";

const SCHEMA_VERSION = "2026-06-09";
const ID_PATTERNS = {
  artifact: /^art_[a-z0-9][a-z0-9_-]*$/,
  evidence: /^ev_[a-z0-9][a-z0-9_-]*$/,
  project: /^proj_[a-z0-9][a-z0-9_-]*$/,
  run: /^run_[a-z0-9][a-z0-9_-]*$/,
};

export { HarnessCoreError as HarnessInputError };

export function createHarness(options = {}) {
  const core = composeHarnessCore(options);
  const {
    now,
    artifactStore,
    observability,
    memory,
    context,
    checkpointStore,
    policyEngine,
    provider,
    toolGateway,
    modules,
  } = core;

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

    readMetrics() {
      return observability.metrics ?? [];
    },

    resume(runId) {
      return checkpointStore.resume(runId);
    },

    approve(input = {}) {
      return checkpointStore.writeApproval(input);
    },

    deny(input = {}) {
      return checkpointStore.writeApproval({ ...input, status: "denied" });
    },

    cancel(input = {}) {
      return unsupportedControlOperation({
        operation: "cancel",
        runId: normalizeId("run", input.runId, "run_local"),
        reason: "runtime_cancellation_not_implemented",
        unavailableSurface: "runtime cancellation orchestration",
      });
    },

    retry(input = {}) {
      return unsupportedControlOperation({
        operation: "retry",
        runId: normalizeId("run", input.runId, "run_local"),
        reason: "manual_retry_command_not_implemented",
        unavailableSurface: "manual retry orchestration",
      });
    },

    inspect() {
      return {
        ...core.inspect(),
        schemaVersion: SCHEMA_VERSION,
        controlSurfaces: controlSurfaces(),
      };
    },
  };
}

function controlSurfaces() {
  return [
    surface("run", "supported_local", "Executes the local deterministic provider workflow through policy, tools, checkpoint, memory/context, artifacts, observability, and evidence."),
    surface("resume", "supported_local", "Reads local checkpoint replay state and redacted replay hash."),
    surface("approve", "supported_local", "Records local approval evidence through the checkpoint store."),
    surface("deny", "supported_local", "Records local denial evidence through the same approval record contract."),
    surface("cancel", "fail_closed_unsupported", "Runtime cancellation orchestration is not implemented beyond typed lifecycle fixtures."),
    surface("retry", "fail_closed_unsupported", "Manual retry orchestration is not implemented; the local provider fail-once recovery fixture remains the supported retry evidence."),
    surface("inspect", "supported_local", "Reports active modules, install paths, source locks, tool adapters, and unavailable surfaces."),
    surface("tools", "supported_local", "Reports function/trusted MCP fixture support plus fail-closed adapter manifests."),
    surface("memory", "supported_local", "Reports local memory/search/context capabilities and replacement paths."),
    surface("context", "supported_local", "Reports deterministic context assembly capabilities and replacement paths."),
    surface("docs", "supported_repo_generator", "Repo-level docs generation exists; SDK docs-output injection is still unavailable."),
    surface("map", "supported_local", "Reports the local module map and adapter inspection state."),
    surface("workbench", "supported_local_static", "Local static workbench generation is supported; hosted workbench/control is unsupported."),
    surface("release", "supported_public_evidence", "Release readiness, package contents, public npm provenance, clean install smoke, GitHub Release, and artifact attestation evidence exist; hosted docs/runtime routes remain unavailable."),
    surface("doctor", "supported_local", "Reports module diagnostics and exact next local setup steps."),
    surface("verify", "supported_local", "Checks local CLI state and core module availability."),
    surface("migration", "fail_closed_unsupported", "Checkpoint/store migration runner is not implemented."),
  ];
}

function surface(operation, status, description) {
  return { operation, status, description };
}

function unsupportedControlOperation({ operation, runId, reason, unavailableSurface }) {
  return {
    ok: false,
    operation,
    runId,
    status: "unsupported",
    failClosed: true,
    reason,
    unavailableSurface,
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
      const runStartedAt = now().toISOString();
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
      if (providerResult.status !== "completed") {
        kernel.fail(providerResult.reason);
        observability.recordUsageMetrics?.({
          runId,
          latencyName: "run.latency_ms",
          latencyMs: elapsedMs(runStartedAt, now().toISOString()),
          inputTokenName: "tokens.input_estimate",
          inputTokens: estimateTokens(executeInput.instruction ?? "produce local harness evidence") + tokenEstimateForContext(contextPack),
          outputTokenName: "tokens.output_estimate",
          outputTokens: estimateTokens(providerResult.output?.text ?? ""),
          costName: "cost.external_billable_usd",
          costUsd: 0,
          toolCallCount: 0,
          source: {
            providerRunRef: providerResult.providerRunId,
          },
          dimensions: {
            providerId: providerResult.providerId,
            providerStatus: providerResult.status,
            environment,
            tokenMeasurement: "character_count_estimate",
            costBasis: "no_external_provider_billing",
          },
        });
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
            { name: "metricRecord", version: SCHEMA_VERSION },
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
          metrics: observability.metrics ?? [],
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
      observability.recordUsageMetrics?.({
        runId,
        latencyName: "run.latency_ms",
        latencyMs: elapsedMs(runStartedAt, now().toISOString()),
        inputTokenName: "tokens.input_estimate",
        inputTokens: estimateTokens(executeInput.instruction ?? "produce local harness evidence") + tokenEstimateForContext(contextPack),
        outputTokenName: "tokens.output_estimate",
        outputTokens: estimateTokens(providerResult.output?.text ?? ""),
        costName: "cost.external_billable_usd",
        costUsd: 0,
        toolCallCount: toolExecutions.length,
        source: {
          traceRef: trace.traceId,
          providerRunRef: providerResult.providerRunId,
        },
        dimensions: {
          providerId: providerResult.providerId,
          providerStatus: providerResult.status,
          environment,
          tokenMeasurement: "character_count_estimate",
          costBasis: "no_external_provider_billing",
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
        metrics: observability.metrics ?? [],
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

function elapsedMs(startedAt, endedAt) {
  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) return 0;
  return ended - started;
}

function tokenEstimateForContext(contextPack) {
  return (contextPack.items ?? []).reduce((total, item) => total + (item.tokenEstimate ?? 0), 0);
}

function estimateTokens(value) {
  return Math.max(1, Math.ceil(String(value ?? "").length / 4));
}

function normalizeId(kind, value, fallback) {
  if (value === undefined) return fallback;
  const pattern = ID_PATTERNS[kind];
  if (typeof value === "string" && pattern.test(value)) return value;
  throw new HarnessCoreError(
    "invalid_identifier",
    `${kind} id must match ${pattern.source}`,
  );
}
