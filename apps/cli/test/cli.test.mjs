import test from "node:test";
import assert from "node:assert/strict";
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

test("run writes inspectable evidence and map output reports missing optional surfaces", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jami-cli-"));
  try {
    const run = await runCli(["run", "--json", "--cwd", cwd, "--run-id", "run_cli_fixture", "--commit", "d6cd77e"]);
    const runPayload = JSON.parse(run.out);
    const evidence = JSON.parse(await readFile(runPayload.evidencePath, "utf8"));
    const inspect = await runCli(["inspect", "--json", "--cwd", cwd, "--run-id", "run_cli_fixture"]);
    const map = await runCli(["map", "--json", "--cwd", cwd]);

    assert.equal(run.code, 0);
    assert.equal(evidence.source.commit, "d6cd77e");
    assert.equal(JSON.parse(inspect.out).latestRun.runId, "run_cli_fixture");
    assert.equal(JSON.parse(map.out).modules.some((module) => module.name === "tools" && !module.available), true);
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

async function runCli(args) {
  let out = "";
  let err = "";
  const code = await main(args, {}, {
    out: (value) => { out += value; },
    err: (value) => { err += value; },
  });
  return { code, out, err };
}
