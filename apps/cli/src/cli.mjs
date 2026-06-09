#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { HarnessInputError, createHarness } from "../../../packages/sdk/src/index.mjs";
import { HarnessStoreError, createFileSystemCheckpointStore } from "../../../packages/store-local/src/index.mjs";

const STATE_DIR = ".jami-harness";
const CONFIG_FILE = "harness.json";
const RUN_ID_PATTERN = /^run_[a-z0-9][a-z0-9_-]*$/;

export async function main(argv = process.argv.slice(2), env = process.env, io = defaultIo()) {
  const parsed = parseArgs(argv);
  if (parsed.help || !parsed.command) {
    io.out(formatOutput(help(), parsed));
    return 0;
  }

  try {
    const cwd = resolve(parsed.options.cwd ?? process.cwd());
    const command = parsed.command;
    if (command === "init") return await initCommand(cwd, parsed, io);
    if (command === "run") return await runCommand(cwd, parsed, io);
    if (command === "resume") return await resumeCommand(cwd, parsed, io);
    if (command === "approve") return await approveCommand(cwd, parsed, io);
    if (command === "inspect") return await inspectCommand(cwd, parsed, io);
    if (command === "doctor") return await doctorCommand(cwd, parsed, io);
    if (command === "tools" || command === "memory" || command === "docs" || command === "map") {
      return await capabilityCommand(cwd, command, parsed, io);
    }
    if (command === "verify") return await verifyCommand(cwd, parsed, io);

    io.err(formatOutput(errorPayload("unknown_command", `Unknown command: ${command}`, 64), parsed));
    return 64;
  } catch (error) {
    const exitCode = error instanceof HarnessInputError || error instanceof HarnessStoreError ? 64 : 1;
    io.err(formatOutput(errorPayload(error.code ?? "command_failed", error.message, exitCode), parsed));
    return exitCode;
  }
}

async function initCommand(cwd, parsed, io) {
  const statePath = join(cwd, STATE_DIR);
  const configPath = join(statePath, CONFIG_FILE);
  await mkdir(statePath, { recursive: true });
  const existed = existsSync(configPath);
  const config = existed ? JSON.parse(await readFile(configPath, "utf8")) : defaultConfig();
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  io.out(formatOutput({
    ok: true,
    command: "init",
    idempotent: existed,
    statePath,
    configPath,
    next: ["jami run --json", "jami inspect --json"],
  }, parsed));
  return 0;
}

async function runCommand(cwd, parsed, io) {
  await initStateIfMissing(cwd);
  const runId = validateRunId(parsed.options["run-id"] ?? parsed.options.runId ?? `run_${Date.now().toString(36)}`);
  const checkpointStore = createCliCheckpointStore(cwd);
  const harness = createHarness({ checkpointStore });
  const result = await harness.run({
    runId,
    providerId: parsed.options["provider-id"] ?? parsed.options.providerId,
    providerFailureMode: parsed.options["provider-failure-mode"] ?? parsed.options.providerFailureMode,
    sourceRepo: "jami-harness",
    sourceCommit: parsed.options.commit ?? "working-tree",
    sourceRef: parsed.options.ref ?? "refs/heads/main",
  });
  const runPath = join(cwd, STATE_DIR, "runs", runId);
  await mkdir(runPath, { recursive: true });
  await writeFile(join(runPath, "evidence.json"), `${JSON.stringify(result.evidence, null, 2)}\n`, "utf8");
  await writeFile(join(runPath, "summary.json"), `${JSON.stringify(toRunSummary(result), null, 2)}\n`, "utf8");
  const completed = result.status === "completed";
  io.out(formatOutput({
    ok: completed,
    command: "run",
    runId,
    status: result.status,
    message: completed ? undefined : result.reason ?? `run ended with status ${result.status}`,
    providerStatus: result.providerResult?.status,
    providerId: result.providerResult?.providerId,
    toolExecutionStatuses: result.toolExecutions?.map((execution) => execution.status) ?? [],
    checkpointId: result.checkpoint.checkpointId,
    replayHash: result.checkpoint.replayHash,
    evidencePath: join(runPath, "evidence.json"),
    summaryPath: join(runPath, "summary.json"),
  }, parsed));
  if (completed) return 0;
  return result.status === "unsupported" ? 2 : 1;
}

async function resumeCommand(cwd, parsed, io) {
  const runId = validateRunId(parsed.options["run-id"] ?? parsed.options.runId);
  const checkpointStore = createCliCheckpointStore(cwd);
  const result = checkpointStore.resume(runId);
  const exitCode = result.resumable ? 0 : result.reason === "run_completed" ? 3 : 2;
  io.out(formatOutput({
    ok: result.resumable,
    command: "resume",
    runId,
    resumable: result.resumable,
    reason: result.reason,
    checkpointId: result.checkpoint?.checkpointId,
    status: result.checkpoint?.status,
    replayHash: result.replayHash,
    next: result.resumable ? ["jami inspect --json --run-id " + runId] : ["jami run --json --run-id " + runId],
  }, parsed));
  return exitCode;
}

async function approveCommand(cwd, parsed, io) {
  await initStateIfMissing(cwd);
  const runId = validateRunId(parsed.options["run-id"] ?? parsed.options.runId);
  const actionId = validateActionId(parsed.options["action-id"] ?? parsed.options.actionId ?? "act_local_approval");
  const checkpointStore = createCliCheckpointStore(cwd);
  const approval = checkpointStore.writeApproval({
    runId,
    actionId,
    actorId: parsed.options.actor ?? "actor_developer",
    scopes: parseCsv(parsed.options.scopes),
    status: parsed.options.status ?? "approved",
  }).approval;
  io.out(formatOutput({
    ok: true,
    command: "approve",
    runId,
    approval,
    approvals: checkpointStore.listApprovals(runId),
  }, parsed));
  return 0;
}

async function inspectCommand(cwd, parsed, io) {
  const checkpointStore = createCliCheckpointStore(cwd);
  const harness = createHarness({ checkpointStore });
  const runId = validateOptionalRunId(parsed.options["run-id"] ?? parsed.options.runId);
  const runSummary = runId ? await readRunSummary(cwd, runId) : await readLatestRunSummary(cwd);
  const checkpoint = runId ? checkpointStore.readCheckpoint(runId) : undefined;
  io.out(formatOutput({
    ok: true,
    command: "inspect",
    statePath: join(cwd, STATE_DIR),
    latestRun: runSummary,
    checkpoint,
    approvals: runId ? checkpointStore.listApprovals(runId) : [],
    harness: harness.inspect(),
    doctor: doctor(harness.inspect(), Boolean(runSummary)),
  }, parsed));
  return 0;
}

async function doctorCommand(cwd, parsed, io) {
  const checkpointStore = createCliCheckpointStore(cwd);
  const harness = createHarness({ checkpointStore });
  const runId = validateOptionalRunId(parsed.options["run-id"] ?? parsed.options.runId);
  const inspection = harness.inspect();
  const checkpoint = runId ? checkpointStore.readCheckpoint(runId) : undefined;
  io.out(formatOutput({
    ok: true,
    command: "doctor",
    statePath: join(cwd, STATE_DIR),
    initialized: existsSync(join(cwd, STATE_DIR, CONFIG_FILE)),
    checkpoint: checkpoint ? {
      runId: checkpoint.runId,
      status: checkpoint.status,
      checkpointId: checkpoint.checkpointId,
      replayHash: checkpoint.replayHash,
      redaction: checkpoint.redaction,
    } : undefined,
    doctor: doctor(inspection, Boolean(checkpoint)),
    harness: inspection,
    installPaths: inspection.installPaths,
  }, parsed));
  return 0;
}

async function capabilityCommand(cwd, command, parsed, io) {
  const inspection = createHarness().inspect();
  const selected = command === "map"
    ? inspection.modules
    : inspection.modules.filter((module) => module.name === command || (command === "tools" && module.name === "tools") || (command === "docs" && module.name === "docsOutput"));
  const includeToolInspection = command === "tools" || command === "map";
  io.out(formatOutput({
    ok: true,
    command,
    statePath: join(cwd, STATE_DIR),
    modules: selected,
    installPaths: inspection.installPaths,
    sourceLocks: inspection.sourceLocks,
    toolAdapters: includeToolInspection ? inspection.toolAdapters : undefined,
    toolAdapterManifests: includeToolInspection ? inspection.toolAdapterManifests : undefined,
    note: command === "map" ? "Active module map only; hosted control plane and workbench are not implemented." : undefined,
  }, parsed));
  return 0;
}

async function verifyCommand(cwd, parsed, io) {
  const statePath = join(cwd, STATE_DIR);
  const configPath = join(statePath, CONFIG_FILE);
  const initialized = existsSync(configPath);
  const inspection = createHarness().inspect();
  const fullInstallPathSupported = inspection.installPaths?.fullLocalHarness?.status === "supported_local_source_checkout";
  const modularPathsSupported = inspection.installPaths?.modularPaths?.some((path) => path.pathId === "byo_memory" && path.status === "supported_port") === true
    && inspection.installPaths?.modularPaths?.some((path) => path.pathId === "byo_docs_output" && path.status === "repo_generator_supported_sdk_output_unavailable") === true;
  io.out(formatOutput({
    ok: initialized,
    command: "verify",
    initialized,
    checks: [
      { name: "local state", status: initialized ? "passed" : "failed", path: configPath },
      { name: "runtime module", status: inspection.modules.find((module) => module.name === "runtime")?.available ? "passed" : "failed" },
      { name: "policy module", status: inspection.modules.find((module) => module.name === "policy")?.available ? "passed" : "failed" },
      { name: "full local harness install path", status: fullInstallPathSupported ? "passed" : "failed" },
      { name: "modular replacement path manifest", status: modularPathsSupported ? "passed" : "failed" },
    ],
    next: initialized ? ["jami run --json", "jami inspect --json"] : ["jami init --json"],
  }, parsed));
  return initialized ? 0 : 2;
}

function help() {
  return {
    ok: true,
    command: "help",
    usage: "jami <init|run|resume|approve|inspect|doctor|tools|memory|docs|map|verify> [--json]",
    commands: {
      init: "Create local .jami-harness state idempotently.",
      run: "Run the local SDK evidence smoke and write evidence under .jami-harness/runs.",
      resume: "Read a stored checkpoint and report replay/resume status.",
      approve: "Record a local approval decision for a run/action.",
      inspect: "Show latest run evidence plus active module capabilities.",
      doctor: "Show module, checkpoint, resume, and missing optional capability diagnostics.",
      tools: "Show tool gateway adapter manifests, source-lock state, and missing setup.",
      memory: "Show memory module capabilities.",
      docs: "Show docs output availability and missing setup.",
      map: "Show all active module capabilities.",
      verify: "Check local CLI state and core module availability.",
    },
  };
}

function parseArgs(argv) {
  const result = { command: undefined, options: {}, json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!result.command && !arg.startsWith("-")) {
      result.command = arg;
      continue;
    }
    if (arg === "--json") {
      result.json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      result.help = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        result.options[key] = next;
        index += 1;
      } else {
        result.options[key] = true;
      }
    }
  }
  return result;
}

function formatOutput(payload, parsed) {
  if (parsed.json) return `${JSON.stringify(payload, null, 2)}\n`;
  if (payload.command === "help") {
    return `${payload.usage}\nCommands: ${Object.keys(payload.commands).join(", ")}\nUse --json for machine-readable output.\n`;
  }
  return `${payload.ok ? "ok" : "error"} ${payload.command}: ${payload.message ?? payload.status ?? ""}\n${JSON.stringify(payload, null, 2)}\n`;
}

async function initStateIfMissing(cwd) {
  const statePath = join(cwd, STATE_DIR);
  const configPath = join(statePath, CONFIG_FILE);
  if (!existsSync(configPath)) {
    await mkdir(statePath, { recursive: true });
    await writeFile(configPath, `${JSON.stringify(defaultConfig(), null, 2)}\n`, "utf8");
  }
}

async function readRunSummary(cwd, runId) {
  const path = join(cwd, STATE_DIR, "runs", runId, "summary.json");
  if (!existsSync(path)) return undefined;
  return JSON.parse(await readFile(path, "utf8"));
}

async function readLatestRunSummary(cwd) {
  const runsPath = join(cwd, STATE_DIR, "runs");
  if (!existsSync(runsPath)) return undefined;
  const runIds = (await readdir(runsPath)).sort();
  const latest = runIds.at(-1);
  return latest ? readRunSummary(cwd, latest) : undefined;
}

function doctor(inspection, hasRun) {
  return {
    status: hasRun ? "ready_for_local_inspection" : "initialized_or_new",
    next: hasRun ? ["jami inspect --json", "jami resume --json --run-id <run_id>", "jami map --json"] : ["jami init --json", "jami run --json"],
    missingOptionalCapabilities: inspection.modules
      .filter((module) => !module.available)
      .map((module) => ({ name: module.name, reasons: module.unavailableReasons })),
  };
}

function toRunSummary(result) {
  return {
    schemaVersion: result.schemaVersion,
    runId: result.runId,
    status: result.status,
    eventCount: result.events.length,
    artifactId: result.artifact?.artifactId,
    evidenceId: result.evidence.evidenceId,
    checkpointId: result.checkpoint.checkpointId,
    replayHash: result.checkpoint.replayHash,
    traceCount: result.traces.length,
    auditCount: result.audits.length,
    provider: result.providerResult ? {
      providerId: result.providerResult.providerId,
      status: result.providerResult.status,
      evidenceRef: result.providerResult.evidenceRef,
    } : undefined,
    tools: result.toolExecutions?.map(({ execution }) => ({
      toolId: execution.toolId,
      status: execution.status,
      evidenceRef: execution.evidenceRef,
      artifactRef: execution.artifactRef,
    })) ?? [],
  };
}

function createCliCheckpointStore(cwd) {
  return createFileSystemCheckpointStore({ root: join(cwd, STATE_DIR) });
}

function defaultConfig() {
  return {
    schemaVersion: "2026-06-09",
    project: "jami-harness-local",
    modules: {
      runtime: "default",
      policy: "default",
      artifacts: "memory",
      observability: "local",
      memory: "memory",
    },
  };
}

function validateOptionalRunId(value) {
  if (value === undefined) return undefined;
  return validateRunId(value);
}

function validateRunId(value) {
  if (typeof value === "string" && RUN_ID_PATTERN.test(value)) return value;
  throw new HarnessInputError("invalid_identifier", `run id must match ${RUN_ID_PATTERN.source}`);
}

function validateActionId(value) {
  if (typeof value === "string" && /^act_[a-z0-9][a-z0-9_-]*$/.test(value)) return value;
  throw new HarnessInputError("invalid_identifier", "action id must match ^act_[a-z0-9][a-z0-9_-]*$");
}

function parseCsv(value) {
  if (value === undefined || value === true) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function errorPayload(code, message, exitCode) {
  return { ok: false, command: "error", code, message, exitCode };
}

function defaultIo() {
  return {
    out: (value) => process.stdout.write(value),
    err: (value) => process.stderr.write(value),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await main();
  process.exit(exitCode);
}
