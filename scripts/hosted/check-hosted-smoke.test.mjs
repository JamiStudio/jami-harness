import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("hosted smoke defaults to fail-closed unconfigured without hosted env", () => {
  const result = runSmoke({}, ["--json"]);

  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.commandResult, "passed");
  assert.equal(check(body, "local_static_route_bundle").status, "passed");
  assert.equal(check(body, "hosted_route_smoke").status, "fail_closed_unconfigured");
  assert.equal(check(body, "hosted_store_smoke").status, "fail_closed_unconfigured");
  assert.equal(check(body, "hosted_provider_smoke").status, "fail_closed_adapter_missing");
  assert.equal(check(body, "hosted_observability_smoke").status, "fail_closed_unconfigured");
});

test("hosted smoke verifies configured HTTP route bundle", async () => {
  const server = createStaticServer();
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const { port } = server.address();
    const result = await runSmokeAsync({ JAMI_HARNESS_HOSTED_BASE_URL: `http://127.0.0.1:${port}/` }, ["--json", "--require-hosted"]);

    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout);
    const hosted = check(body, "hosted_route_smoke");
    assert.equal(hosted.status, "passed");
    assert.equal(hosted.responses.length, 4);
    assert.equal(hosted.responses.every((response) => response.statusCode === 200), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("hosted smoke strict store mode fails until a real hosted store adapter exists", () => {
  const result = runSmoke({ NEON_DATABASE_URL: "postgres://user:pass@example.neon.tech/db" }, ["--json", "--require-store"]);

  assert.equal(result.status, 2);
  const body = JSON.parse(result.stdout);
  assert.equal(check(body, "hosted_store_smoke").status, "fail_closed_adapter_missing");
  assert.match(body.requiredFailures.join("\n"), /hosted store smoke is not executable/);
  assert.doesNotMatch(result.stdout, /pass@example/);
});

function runSmoke(env, args) {
  const cleanEnv = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    COMSPEC: process.env.COMSPEC,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    ...env,
  };
  return spawnSync(process.execPath, ["scripts/hosted/check-hosted-smoke.mjs", ...args], {
    cwd: repoRoot,
    env: cleanEnv,
    encoding: "utf8",
  });
}

function runSmokeAsync(env, args) {
  const cleanEnv = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    COMSPEC: process.env.COMSPEC,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    ...env,
  };
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/hosted/check-hosted-smoke.mjs", ...args], {
      cwd: repoRoot,
      env: cleanEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function check(body, surface) {
  const entry = body.checks.find((candidate) => candidate.surface === surface);
  assert.ok(entry, `missing ${surface}`);
  return entry;
}

function createStaticServer() {
  const distRoot = join(repoRoot, "apps/workbench/dist");
  return createServer((request, response) => {
    const requested = new URL(request.url ?? "/", "http://localhost").pathname;
    const file = requested === "/" ? "healthz.json" : requested.replace(/^\//, "");
    const fullPath = join(distRoot, file);
    if (!existsSync(fullPath)) {
      response.writeHead(404).end("not found");
      return;
    }
    const contentType = extname(fullPath) === ".json" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8";
    response.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    response.end(readFileSync(fullPath, "utf8"));
  });
}
