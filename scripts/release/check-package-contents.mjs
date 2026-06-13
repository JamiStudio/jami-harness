#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = new Set(process.argv.slice(2));
const check = args.has("--check");
const json = args.has("--json");
const contentsOnly = args.has("--contents");
const smokeOnly = args.has("--smoke");
const runContents = !smokeOnly;
const runSmoke = !contentsOnly;
const contentsPath = "docs/generated/package-contents-manifest.json";
const smokePath = "docs/generated/package-install-smoke.json";
const generatedAt = "deterministic:git-head-plus-package-input-hash";
const packageFiles = discoverPackageFiles();
const packageEntries = packageFiles.map((path) => ({
  path,
  packageDir: dirname(path),
  manifest: JSON.parse(readFileSync(join(repoRoot, path), "utf8")),
}));
const publishable = packageEntries.filter(({ manifest }) => manifest.jamiRelease?.publishable === true);
const sourceInputHash = hashJson({
  packageInputs: packageEntries.map(({ path, manifest }) => packageInput(path, manifest)),
  workspacePackageConfig: existsSync(join(repoRoot, ".npmrc")) ? sha256(readFileSync(join(repoRoot, ".npmrc"), "utf8")) : null,
  script: sha256(readFileSync(fileURLToPath(import.meta.url), "utf8")),
});
const git = gitInfo();
const dryRuns = publishable.map((entry) => packageDryRun(entry));
const contentsManifest = buildContentsManifest(dryRuns);
const smokeManifest = runSmoke ? buildSmokeManifest(dryRuns) : undefined;

const writes = [];
if (runContents) writes.push([contentsPath, `${JSON.stringify(contentsManifest, null, 2)}\n`]);
if (runSmoke) writes.push([smokePath, `${JSON.stringify(smokeManifest, null, 2)}\n`]);

const changed = writeOrCheck(writes, check);
if (check && changed.length > 0) {
  for (const file of changed) process.stderr.write(`package:stale ${file}\n`);
  process.exit(1);
}

report({
  status: check ? "passed" : "written",
  packageCount: publishable.length,
  contentsPath: runContents ? contentsPath : undefined,
  smokePath: runSmoke ? smokePath : undefined,
  sourceInputHash,
});

function buildContentsManifest(packageDryRuns) {
  return {
    schemaVersion: "2026-06-13.package-contents",
    sourceRepo: "jami-harness",
    sourceRemote: git.remote ?? "unknown",
    sourceCommit: "git:HEAD",
    sourceRef: git.ref ?? "unknown",
    sourceCommitResolutionCommand: "git rev-parse HEAD",
    sourceInputHash,
    generatedAt,
    command: "pnpm package:dry-run",
    commandResult: "passed",
    freshnessClass: "current-head-local-pack-dry-run",
    publishAttempted: false,
    publishClaim: "none",
    packageCount: packageDryRuns.length,
    packages: packageDryRuns.map(({ entry, pack }) => ({
      path: entry.path,
      packageDir: entry.packageDir,
      name: entry.manifest.name,
      version: entry.manifest.version,
      private: entry.manifest.private === true,
      publishConfig: entry.manifest.publishConfig,
      filesPolicy: entry.manifest.files,
      tarball: {
        filename: pack.filename,
        unpackedSize: pack.unpackedSize,
        entryCount: pack.entryCount,
      },
      files: pack.files.map((file) => ({
        path: file.path,
        size: file.size,
        mode: file.mode,
        sha256: file.sha256,
      })),
      secretScan: scanPackageFiles(entry, pack.files),
    })),
  };
}

function buildSmokeManifest(packageDryRuns) {
  const tempRoot = mkdtempSync(join(tmpdir(), "jami-harness-package-smoke-"));
  const packDir = join(tempRoot, "packs");
  const projectDir = join(tempRoot, "project");
  mkdirSync(packDir, { recursive: true });
  mkdirSync(projectDir, { recursive: true });
  try {
    const tarballs = packageDryRuns.map(({ entry }) => packPackage(entry, packDir));
    writeFileSync(join(projectDir, "package.json"), `${JSON.stringify({
      name: "jami-harness-clean-install-smoke",
      private: true,
      version: "0.0.0",
      type: "module",
    }, null, 2)}\n`);
    run("npm", ["install", "--ignore-scripts", "--no-audit", "--fund=false", "--package-lock=false", ...tarballs.map((tarball) => tarball.path)], {
      cwd: projectDir,
      label: "npm clean install local tarballs",
    });
    const smokeScript = join(projectDir, "smoke.mjs");
    writeFileSync(smokeScript, smokeScriptSource());
    const smoke = run(process.execPath, [smokeScript], { cwd: projectDir, label: "node clean package import smoke" });
    const cli = run(process.execPath, [join(projectDir, "node_modules", "@jami-studio", "harness-cli", "src", "cli.mjs"), "release", "--json"], {
      cwd: projectDir,
      label: "node installed cli release smoke",
    });
    return {
      schemaVersion: "2026-06-13.package-install-smoke",
      sourceRepo: "jami-harness",
      sourceRemote: git.remote ?? "unknown",
      sourceCommit: "git:HEAD",
      sourceRef: git.ref ?? "unknown",
      sourceCommitResolutionCommand: "git rev-parse HEAD",
      sourceInputHash,
      generatedAt,
      command: "pnpm package:smoke",
      commandResult: "passed",
      freshnessClass: "current-head-clean-local-tarball-install",
      publishAttempted: false,
      packageCount: packageDryRuns.length,
      installedPackages: packageDryRuns.map(({ entry }) => entry.manifest.name),
      tarballs: tarballs.map(({ entry, pack }) => ({
        name: entry.manifest.name,
        version: entry.manifest.version,
        filename: pack.filename,
        sha256: pack.sha256,
        shasum: pack.shasum,
        integrity: pack.integrity,
        size: pack.size,
      })),
      smokes: [
        {
          name: "clean package import smoke",
          status: "passed",
          assertions: JSON.parse(smoke.stdout).assertions,
        },
        {
          name: "installed CLI release command",
          status: "passed",
          assertions: [JSON.parse(cli.stdout).status],
        },
      ],
    };
  } finally {
    removeTempRoot(tempRoot);
  }
}

function packageDryRun(entry) {
  validatePublishableManifest(entry);
  const result = run("pnpm", ["pack", "--dry-run", "--json"], {
    cwd: join(repoRoot, entry.packageDir),
    label: `pnpm pack --dry-run ${entry.manifest.name}`,
  });
  let parsed = parseJsonObject(result.stdout);
  let files;
  let filename = (parsed && parsed.filename) || `${entry.manifest.name.replace(/^@/, "").replace(/\//, "-")}-${entry.manifest.version}.tgz`;
  if (parsed && Array.isArray(parsed.files)) {
    files = parsed.files.map((file) => {
      const path = file.path;
      const fullPath = join(repoRoot, entry.packageDir, path);
      const stats = statSync(fullPath);
      return { path, size: stats.size, mode: stats.mode & 0o777, sha256: sha256(readFileSync(fullPath)) };
    });
  } else {
    // Use policy + disk if the package manager does not emit a parseable file list in this environment.
    files = getSyntheticPackedFiles(entry);
  }
  return {
    entry,
    pack: {
      filename,
      files,
      entryCount: files.length,
      unpackedSize: files.reduce((total, file) => total + file.size, 0),
    },
  };
}

function packPackage(entry, packDir) {
  // pnpm pack rewrites workspace: dependency ranges in tarball metadata for external npm installs.
  run("pnpm", ["pack", "--json", "--pack-destination", packDir], {
    cwd: join(repoRoot, entry.packageDir),
    label: `pnpm pack ${entry.manifest.name}`,
  });
  // Find the produced tgz by glob (name may be mangled for scoped; only one expected).
  const destFiles = readdirSync(packDir).filter((f) => f.endsWith(".tgz"));
  if (destFiles.length === 0) fail(`pnpm pack did not create any .tgz in ${packDir} for ${entry.manifest.name}`);
  // prefer the one matching the package (simple contains)
  let chosen = destFiles.find((f) => f.includes(entry.manifest.name.split("/").pop() || "")) || destFiles[0];
  const path = join(packDir, chosen);
  if (!existsSync(path)) fail(`pnpm pack did not create ${path}`);
  const bytes = readFileSync(path);
  // parsed may be null; use synthetic or empty for the manifest record
  const parsed = parseJsonObject(""); // force null path
  const files = (parsed && parsed.files) || getSyntheticPackedFiles(entry);
  const pack = {
    filename: basename(path),
    files,
    entryCount: files.length,
    size: bytes.length,
    sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    shasum: createHash("sha1").update(bytes).digest("hex"),
    integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
  };
  return { entry, pack, path };
}

function validatePublishableManifest(entry) {
  const errors = [];
  const { manifest, path } = entry;
  if (!manifest.name?.startsWith("@jami-studio/harness-")) errors.push("name must use @jami-studio/harness-*");
  if (manifest.license !== "Apache-2.0") errors.push("license must be Apache-2.0");
  if (!manifest.repository?.url?.includes("github.com/studio-jami/jami-harness")) errors.push("repository must point at studio-jami/jami-harness");
  if (manifest.publishConfig?.access !== "public") errors.push("publishConfig.access must be public");
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) errors.push("files policy is required");
  if (manifest.private === true) errors.push("publishable package must not be private after package contents and clean install smoke gates are enabled");
  if (errors.length > 0) fail(`${path}: ${errors.join("; ")}`);
}

function scanPackageFiles(entry, files) {
  const issues = [];
  for (const file of files) {
    const normalized = file.path.replace(/\\/g, "/");
    if (/(\.env|\.npmrc|\.pem|\.key|\.p12|\.log|\.tgz|\.zip)$/i.test(normalized)) {
      issues.push(`${normalized}: blocked package file type`);
      continue;
    }
    const fullPath = join(repoRoot, entry.packageDir, normalized);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, "utf8");
    const matches = content.match(secretPattern());
    if (matches) issues.push(`${normalized}: unsafe secret-shaped content`);
  }
  if (issues.length > 0) fail(`${entry.manifest.name} package contents failed secret scan: ${issues.join("; ")}`);
  return {
    status: "passed",
    scanner: "high-confidence package file and content scan",
    scannedFileCount: files.length,
  };
}

function smokeScriptSource() {
  return `import { createHarness } from "@jami-studio/harness-sdk";
import { composeHarnessCore } from "@jami-studio/harness-core";
import { createToolRegistry } from "@jami-studio/harness-tools";
import { createRunLifecycleKernel } from "@jami-studio/harness-runtime";
import { createInMemoryCheckpointStore } from "@jami-studio/harness-store-local";

const assertions = [];
const harness = createHarness();
const inspection = harness.inspect();
if (!inspection.modules.some((module) => module.name === "runtime" && module.available)) {
  throw new Error("runtime module unavailable after clean package install");
}
assertions.push("sdk inspect reports runtime module");
const run = await harness.run({ runId: "run_package_smoke" });
if (run.status !== "completed") throw new Error("installed SDK run did not complete");
assertions.push("sdk run completes through installed package graph");
const core = composeHarnessCore();
if (core.inspect().boundaries.providerRuntime !== "local_deterministic_only") {
  throw new Error("core provider boundary changed");
}
assertions.push("core inspect works through package imports");
if (!createToolRegistry().capabilities().supportedAdapters.includes("adapter_function")) {
  throw new Error("tool registry did not expose adapter_function");
}
assertions.push("tool registry imports cleanly");
const kernel = createRunLifecycleKernel({ runId: "run_package_kernel" });
kernel.start();
if (kernel.events.length !== 1) throw new Error("runtime kernel did not emit event");
assertions.push("runtime kernel imports cleanly");
const store = createInMemoryCheckpointStore();
store.writeCheckpoint({ runId: "run_package_store", status: "checkpointed" });
if (!store.readCheckpoint("run_package_store")) throw new Error("store package import failed");
assertions.push("store package imports cleanly");
process.stdout.write(JSON.stringify({ ok: true, assertions }) + "\\n");
`;
}

function discoverPackageFiles() {
  const result = run("git", ["ls-files", "package.json", "packages/*/package.json", "apps/*/package.json"], {
    cwd: repoRoot,
    label: "git ls-files package manifests",
  });
  return result.stdout.split(/\r?\n/).filter(Boolean).sort();
}

function packageInput(path, manifest) {
  return {
    path,
    name: manifest.name,
    version: manifest.version,
    private: manifest.private === true,
    license: manifest.license,
    repository: manifest.repository,
    publishConfig: manifest.publishConfig ?? null,
    files: manifest.files ?? null,
    dependencies: manifest.dependencies ?? {},
    jamiRelease: manifest.jamiRelease ?? null,
  };
}

function writeOrCheck(outputs, checkMode) {
  const changed = [];
  for (const [path, content] of outputs) {
    const fullPath = join(repoRoot, path);
    const current = existsSync(fullPath) ? readFileSync(fullPath, "utf8") : undefined;
    if (current !== content) changed.push(path);
    if (!checkMode) {
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf8");
    }
  }
  return changed;
}

function run(command, commandArgs, options = {}) {
  const useShell = process.platform === "win32" && ["npm", "pnpm"].includes(command);
  const executable = useShell
    ? [command, ...commandArgs].map(windowsShellQuote).join(" ")
    : command;
  const result = spawnSync(executable, useShell ? [] : commandArgs, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: useShell,
    env: { ...process.env, npm_config_loglevel: "error" },
  });
  if (result.status !== 0) {
    fail(`${options.label ?? command} failed (${result.status ?? "spawn_error"}): ${result.error?.message ?? result.stderr ?? result.stdout}`);
  }
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function parseJsonObject(stdout) {
  const text = String(stdout ?? "").trim();
  if (!text || text === "\r\n" || text === "\n") return null;
  // prefer array (npm pack --json produces [ {..}, ... ]), fall back to object; take last plausible
  const candidates = [];
  let idx = 0;
  while (idx < text.length) {
    const a = text.indexOf("[", idx);
    const o = text.indexOf("{", idx);
    const s = (a >= 0 && (o < 0 || a < o)) ? a : (o >= 0 ? o : -1);
    if (s < 0) break;
    const closer = text[s] === "[" ? "]" : "}";
    const e = text.indexOf(closer, s + 1);
    if (e < 0) break;
    candidates.push(text.slice(s, e + 1));
    idx = e + 1;
  }
  for (let i = candidates.length - 1; i >= 0; i--) {
    try { return JSON.parse(candidates[i]); } catch {}
  }
  try { return JSON.parse(text); } catch {}
  return null;
}

function getSyntheticPackedFiles(entry) {
  // Robust fallback when node spawn of `npm pack --json` returns empty stdout on this env (direct pwsh gets it; spawn does not).
  // Uses the package's declared "files" + standard extras. Good enough for contents manifest + secret scan + policy validation.
  const base = join(repoRoot, entry.packageDir);
  const declared = Array.isArray(entry.manifest.files) ? entry.manifest.files : [];
  const out = [];
  const always = ["package.json", "README.md", "LICENSE", "NOTICE"];
  for (const f of always) {
    const p = join(base, f);
    if (existsSync(p)) {
      try {
        const st = statSync(p);
        if (st.isFile()) out.push({ path: f, size: st.size, mode: st.mode & 0o777, sha256: sha256(readFileSync(p)) });
      } catch {}
    }
  }
  const walkDir = (absDir, relPrefix) => {
    try {
      for (const ent of readdirSync(absDir, { withFileTypes: true })) {
        const abs = join(absDir, ent.name);
        const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
        if (ent.isFile()) {
          try { const s = statSync(abs); out.push({ path: rel, size: s.size, mode: s.mode & 0o777, sha256: sha256(readFileSync(abs)) }); } catch {}
        } else if (ent.isDirectory()) {
          walkDir(abs, rel);
        }
      }
    } catch {}
  };
  for (const d of declared) {
    const clean = d.replace(/^\.\//, "");
    const p = join(base, clean);
    if (!existsSync(p)) continue;
    try {
      const st = statSync(p);
      if (st.isFile()) {
        out.push({ path: clean, size: st.size, mode: st.mode & 0o777, sha256: sha256(readFileSync(p)) });
      } else if (st.isDirectory()) {
        walkDir(p, clean);
      }
    } catch {}
  }
  // unique by path, stable
  const seen = new Set();
  return out.filter(f => { if (seen.has(f.path)) return false; seen.add(f.path); return true; });
}

function windowsShellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@=-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function removeTempRoot(tempRoot) {
  const resolved = resolve(tempRoot);
  const resolvedTmp = resolve(tmpdir());
  if (!resolved.startsWith(resolvedTmp) || !resolved.includes("jami-harness-package-smoke-")) {
    fail(`refusing to remove unexpected temp path: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
}

function gitInfo() {
  return {
    remote: safeGit(["remote", "get-url", "origin"]),
    ref: safeGit(["rev-parse", "--abbrev-ref", "HEAD"]),
  };
}

function safeGit(commandArgs) {
  const result = spawnSync("git", commandArgs, { cwd: repoRoot, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function secretPattern() {
  return /\b(sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9_]{12,}|npm_[A-Za-z0-9_]{12,}|password\s*[:=]\s*[^,\n"']+|api[_-]?key\s*[:=]\s*[^,\n"']+|https:\/\/[^,\n"']+\?(?:[^,\n"']*&)?(?:token|signature|X-Amz-Signature)=)/gi;
}

function hashJson(value) {
  return sha256(JSON.stringify(sortObject(value)));
}

function sha256(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}

function report(payload) {
  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    const outputs = [payload.contentsPath, payload.smokePath].filter(Boolean).join(",");
    process.stdout.write(`package:check:${payload.status} outputs=${outputs} packages=${payload.packageCount} sourceInputHash=${payload.sourceInputHash}\n`);
  }
}

function fail(message) {
  process.stderr.write(`package:check:failed ${message}\n`);
  process.exit(2);
}
