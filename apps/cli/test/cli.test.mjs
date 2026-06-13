import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { main } from "../src/cli.mjs";

test("init is idempotent and emits JSON", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jami-cli-"));
  try {
    const first = await runCli(["init", "--json", "--cwd", cwd]);
    const second = await runCli(["init", "--json", "--cwd", cwd]);

    assert.equal(first.code, 0);
    assert.equal(JSON.parse(first.out).idempotent, false);
    assert.equal(second.code, 0);
    assert.equal(JSON.parse(second.out).idempotent, true);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("run writes inspectable evidence, checkpoint, and map output reports missing optional surfaces", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jami-cli-"));
  try {
    const run = await runCli(["run", "--json", "--cwd", cwd, "--run-id", "run_cli_fixture", "--commit", "d6cd77e"]);
    const runPayload = JSON.parse(run.out);
    const evidence = JSON.parse(await readFile(runPayload.evidencePath, "utf8"));
    const summary = JSON.parse(await readFile(runPayload.summaryPath, "utf8"));
    const inspect = await runCli(["inspect", "--json", "--cwd", cwd, "--run-id", "run_cli_fixture"]);
    const resume = await runCli(["resume", "--json", "--cwd", cwd, "--run-id", "run_cli_fixture"]);
    const doctor = await runCli(["doctor", "--json", "--cwd", cwd, "--run-id", "run_cli_fixture"]);
    const map = await runCli(["map", "--json", "--cwd", cwd]);
    const docs = await runCli(["docs", "--json", "--cwd", cwd]);
    const context = await runCli(["context", "--json", "--cwd", cwd]);
    const tools = await runCli(["tools", "--json", "--cwd", cwd]);
    const workbench = await runCli(["workbench", "--json", "--cwd", cwd]);
    const release = await runCli(["release", "--json", "--cwd", cwd]);
    const verify = await runCli(["verify", "--json", "--cwd", cwd]);
    const mapPayload = JSON.parse(map.out);
    const docsPayload = JSON.parse(docs.out);
    const contextPayload = JSON.parse(context.out);
    const toolsPayload = JSON.parse(tools.out);
    const workbenchPayload = JSON.parse(workbench.out);
    const releasePayload = JSON.parse(release.out);

    assert.equal(run.code, 0);
    assert.equal(runPayload.providerStatus, "completed");
    assert.equal(runPayload.providerId, "provider_local_deterministic");
    assert.deepEqual(runPayload.toolExecutionStatuses, ["completed"]);
    assert.equal(evidence.source.commit, "d6cd77e");
    assert.match(summary.replayHash, /^sha256:/);
    assert.equal(summary.provider.status, "completed");
    assert.equal(summary.tools[0].status, "completed");
    assert.equal(JSON.parse(inspect.out).latestRun.runId, "run_cli_fixture");
    assert.equal(JSON.parse(inspect.out).checkpoint.status, "completed");
    assert.equal(resume.code, 3);
    assert.equal(JSON.parse(resume.out).reason, "run_completed");
    assert.equal(JSON.parse(doctor.out).checkpoint.runId, "run_cli_fixture");
    assert.equal(mapPayload.modules.some((module) => module.name === "tools" && module.available), true);
    assert.equal(mapPayload.installPaths.fullLocalHarness.status, "supported_local_source_checkout");
    assert.equal(mapPayload.installPaths.modularPaths.some((path) => path.pathId === "byo_store" && path.status === "supported_port"), true);
    assert.equal(mapPayload.controlSurfaces.some((surface) => surface.operation === "deny" && surface.status === "supported_local"), true);
    assert.equal(mapPayload.controlSurfaces.some((surface) => surface.operation === "cancel" && surface.status === "fail_closed_unsupported"), true);
    assert.equal(docsPayload.installPaths.modularPaths.some((path) => path.pathId === "byo_docs_output" && path.status === "repo_generator_supported_sdk_output_unavailable"), true);
    assert.equal(contextPayload.modules.some((module) => module.name === "context" && module.available), true);
    assert.equal(JSON.parse(verify.out).checks.some((check) => check.name === "full local harness install path" && check.status === "passed"), true);
    assert.equal(JSON.parse(verify.out).checks.some((check) => check.name === "modular replacement path manifest" && check.status === "passed"), true);
    assert.equal(toolsPayload.toolAdapters.some((adapter) => adapter.adapterId === "adapter_openapi" && adapter.support === "unsupported"), true);
    assert.equal(toolsPayload.toolAdapters.some((adapter) => adapter.adapterId === "adapter_function" && adapter.support === "supported"), true);
    assert.equal(toolsPayload.sourceLocks.some((sourceLock) => sourceLock.adapterId === "adapter_mcp" && sourceLock.status === "locked"), true);
    assert.equal(toolsPayload.toolAdapterManifests.some((manifest) => manifest.capabilityId === "cap_shell_tool_gateway"), true);
    assert.equal(workbenchPayload.status, "local_static_available");
    assert.equal(workbenchPayload.unavailable.some((surface) => surface.surface === "hosted workbench/control"), true);
    assert.equal(releasePayload.status, "public_release_evidence_available_hosted_runtime_unsupported");
    assert.equal(releasePayload.failClosed, true);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("run fails closed for unsupported external provider routes", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jami-cli-"));
  try {
    const run = await runCli([
      "run",
      "--json",
      "--cwd",
      cwd,
      "--run-id",
      "run_cli_external_provider",
      "--provider-id",
      "provider_openai",
    ]);
    const runPayload = JSON.parse(run.out);
    const summary = JSON.parse(await readFile(runPayload.summaryPath, "utf8"));

    assert.equal(run.code, 2);
    assert.equal(runPayload.ok, false);
    assert.equal(runPayload.status, "unsupported");
    assert.equal(runPayload.providerStatus, "auth_missing");
    assert.equal(summary.provider.status, "auth_missing");
    assert.equal(summary.tools.length, 0);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("run records recoverable local provider retry evidence", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jami-cli-"));
  try {
    const run = await runCli([
      "run",
      "--json",
      "--cwd",
      cwd,
      "--run-id",
      "run_cli_provider_retry",
      "--provider-failure-mode",
      "fail_once",
    ]);
    const runPayload = JSON.parse(run.out);
    const summary = JSON.parse(await readFile(runPayload.summaryPath, "utf8"));

    assert.equal(run.code, 0);
    assert.equal(runPayload.status, "completed");
    assert.equal(summary.provider.status, "completed");
    assert.equal(summary.tools[0].status, "completed");
    assert.match(summary.replayHash, /^sha256:/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("approve and deny record local decision evidence and reject malformed action ids", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jami-cli-"));
  try {
    await runCli(["init", "--json", "--cwd", cwd]);
    const approved = await runCli([
      "approve",
      "--json",
      "--cwd",
      cwd,
      "--run-id",
      "run_cli_approval",
      "--action-id",
      "act_publish_release",
      "--scopes",
      "release:publish",
    ]);
    const denied = await runCli([
      "deny",
      "--json",
      "--cwd",
      cwd,
      "--run-id",
      "run_cli_approval",
      "--action-id",
      "act_publish_release",
      "--scopes",
      "release:publish",
    ]);
    const rejected = await runCli(["approve", "--json", "--cwd", cwd, "--run-id", "run_cli_approval", "--action-id", "../bad"]);

    assert.equal(approved.code, 0);
    assert.equal(denied.code, 0);
    assert.equal(JSON.parse(approved.out).approval.actionId, "act_publish_release");
    assert.equal(JSON.parse(approved.out).approval.status, "approved");
    assert.equal(JSON.parse(denied.out).approval.status, "denied");
    assert.equal(JSON.parse(denied.out).approvals.length, 1);
    assert.equal(JSON.parse(denied.out).approvals[0].status, "denied");
    assert.equal(rejected.code, 64);
    assert.equal(JSON.parse(rejected.err).code, "invalid_identifier");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("cancel, retry, and migration report fail-closed unsupported JSON", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jami-cli-"));
  try {
    await runCli(["run", "--json", "--cwd", cwd, "--run-id", "run_cli_control"]);
    const cancel = await runCli(["cancel", "--json", "--cwd", cwd, "--run-id", "run_cli_control"]);
    const retry = await runCli(["retry", "--json", "--cwd", cwd, "--run-id", "run_cli_control"]);
    const migration = await runCli(["migration", "--json", "--cwd", cwd]);

    assert.equal(cancel.code, 2);
    assert.equal(JSON.parse(cancel.out).failClosed, true);
    assert.equal(JSON.parse(cancel.out).reason, "runtime_cancellation_not_implemented");
    assert.equal(JSON.parse(cancel.out).checkpointStatus, "completed");
    assert.equal(retry.code, 2);
    assert.equal(JSON.parse(retry.out).reason, "manual_retry_command_not_implemented");
    assert.equal(migration.code, 2);
    assert.equal(JSON.parse(migration.out).reason, "checkpoint_store_migration_not_implemented");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("unsupported control routes do not initialize local state", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jami-cli-"));
  try {
    const cancel = await runCli(["cancel", "--json", "--cwd", cwd, "--run-id", "run_cli_no_state"]);
    const retry = await runCli(["retry", "--json", "--cwd", cwd, "--run-id", "run_cli_no_state"]);
    const migration = await runCli(["migration", "--json", "--cwd", cwd]);

    assert.equal(cancel.code, 2);
    assert.equal(JSON.parse(cancel.out).failClosed, true);
    assert.equal(retry.code, 2);
    assert.equal(migration.code, 2);
    assert.equal(existsSync(join(cwd, ".jami-harness")), false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("verify returns a clean nonzero code before init and succeeds after init", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jami-cli-"));
  try {
    const before = await runCli(["verify", "--json", "--cwd", cwd]);
    await runCli(["init", "--json", "--cwd", cwd]);
    const after = await runCli(["verify", "--json", "--cwd", cwd]);

    assert.equal(before.code, 2);
    assert.equal(JSON.parse(before.out).initialized, false);
    assert.equal(after.code, 0);
    assert.equal(JSON.parse(after.out).initialized, true);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("rejects malformed run ids with JSON error output", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jami-cli-"));
  try {
    const run = await runCli(["run", "--json", "--cwd", cwd, "--run-id", "../outside"]);
    const inspect = await runCli(["inspect", "--json", "--cwd", cwd, "--run-id", "..\\outside"]);

    assert.equal(run.code, 64);
    assert.equal(JSON.parse(run.err).code, "invalid_identifier");
    assert.equal(inspect.code, 64);
    assert.equal(JSON.parse(inspect.err).code, "invalid_identifier");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

async function runCli(args) {
  let out = "";
  let err = "";
  const code = await main(args, {}, {
    out: (value) => { out += value; },
    err: (value) => { err += value; },
  });
  return { code, out, err };
}
