import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { main as cliMain } from "../../cli/src/cli.mjs";
import { buildWorkbenchModel } from "../scripts/generate-workbench.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

test("workbench model is sourced from SDK runtime evidence and generated docs manifests", async () => {
  const model = await buildWorkbenchModel();

  assert.equal(model.boundary.mode, "local_static_workbench");
  assert.equal(model.boundary.hostedWorkbench, "unsupported_fail_closed");
  assert.equal(model.boundary.studioUiPackageIntegration, "not_claimed");
  assert.equal(model.runtimeEvidence.status, "completed");
  assert.equal(model.runtimeEvidence.provider.providerId, "provider_local_deterministic");
  assert.equal(model.views.timeline.some((event) => event.eventType === "run.started"), true);
  assert.equal(model.views.approvals[0].actionId, "act_workbench_local_review");
  assert.equal(model.views.artifacts.some((artifact) => artifact.evidenceRef === model.runtimeEvidence.evidenceId), true);
  assert.equal(model.views.traces.some((trace) => trace.name === "sdk.run"), true);
  assert.equal(model.views.memory.records[0].artifactRef, "docs/generated/docs-source-manifest.json");
  assert.equal(model.views.memory.contextPack.itemCount, 1);
  assert.equal(model.views.docsPreview.some((doc) => doc.path === "docs/generated/system-map.md"), true);
  assert.match(model.views.systemMap.mermaid, /flowchart LR/);
  assert.equal(model.unavailable.some((surface) => surface.surface === "Hosted workbench"), true);
});

test("workbench check mode matches committed generated outputs", () => {
  const result = spawnSync(process.execPath, ["apps/workbench/scripts/generate-workbench.mjs", "--check"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("workbench can consume explicit local CLI state without reading unrelated files", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jami-workbench-cli-"));
  try {
    await runCli(["run", "--json", "--cwd", cwd, "--run-id", "run_workbench_cli_state"]);
    await runCli([
      "approve",
      "--json",
      "--cwd",
      cwd,
      "--run-id",
      "run_workbench_cli_state",
      "--action-id",
      "act_workbench_cli_state",
    ]);
    const model = await buildWorkbenchModel({ stateRoot: join(cwd, ".jami-harness") });

    assert.equal(model.views.localState.status, "loaded");
    assert.equal(model.views.localState.runs[0].runId, "run_workbench_cli_state");
    assert.equal(model.views.localState.runs[0].summary.status, "completed");
    assert.equal(model.views.localState.approvals[0].actionId, "act_workbench_cli_state");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("generated static shell embeds the workbench manifest for file-open use", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");

  assert.match(html, /id="workbench-data"/);
  assert.match(html, /Run Timeline/);
  assert.match(html, /Hosted workbench/);
});

async function runCli(args) {
  let out = "";
  let err = "";
  const code = await cliMain(args, {}, {
    out: (value) => { out += value; },
    err: (value) => { err += value; },
  });
  assert.equal(code, 0, err || out);
  return JSON.parse(out);
}
