#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = new Set(process.argv.slice(2));
const json = args.has("--json");
const dryRun = args.has("--dry-run");
const strictCheck = args.has("--check");

const packageFiles = discoverPackageFiles();
const manifests = packageFiles.map((file) => ({
  path: file,
  manifest: JSON.parse(readFileSync(join(repoRoot, file), "utf8")),
}));

const git = gitInfo();
const checks = [
  checkScript("docs:check", "repo docs check command"),
  checkScript("docs:generate", "generated docs command"),
  checkScript("docs:generate:check", "generated docs drift check"),
  checkScript("verify", "full local verification gate"),
  checkScript("contracts:generate:check", "generated contract drift check"),
  checkScript("contracts:validate", "contract and fixture validation"),
  checkScript("sbom:generate", "local SBOM generation command"),
  checkScript("sbom:check", "local SBOM drift check command"),
  checkScript("release:readiness", "release readiness audit command"),
  checkScript("release:dry-run", "non-publishing release dry-run command"),
  checkFile("pnpm-lock.yaml", "lockfile for frozen local and manual CI installs"),
  checkFile("LICENSE", "repository license file"),
  checkFile("NOTICE", "source and third-party provenance notice"),
  checkFile("docs/operations/release-readiness.md", "release, claims, SBOM, and attestation policy"),
  checkFile("docs/operations/sbom-source-lock.md", "repo-local SBOM source-lock evidence"),
  checkFile("docs/generated/docs-source-manifest.json", "generated docs-source manifest"),
  checkFile("docs/generated/sbom.cdx.json", "generated local CycloneDX SBOM dry-run artifact"),
  checkFile("apps/docs/docs.json", "Mintlify-ready navigation draft"),
  checkFile(".github/workflows/manual-check.yml", "manual GitHub fallback workflow"),
  checkWorkflow(),
  checkNoTrackedEnv(),
  checkPackageMetadata(),
  checkPrivatePublishBlock(),
  checkDocsPolicy("Public Claims Matrix", "public claims matrix"),
  checkDocsPolicy("SBOM Policy", "SBOM policy"),
  checkDocsPolicy("Package Provenance And Attestation Policy", "package provenance and attestation policy"),
  checkDocsPolicy("Human Interventions", "human/account intervention ledger"),
];

const unavailableCommands = [
  {
    command: "npm publish --dry-run --provenance",
    status: "unavailable",
    reason: "all publishable package manifests remain private and npm automation scope is not recorded",
  },
  {
    command: "gh attestation sign/verify",
    status: "unavailable",
    reason: "GitHub release artifact attestation workflow is not implemented or authorized yet",
  },
  {
    command: "mintlify build",
    status: "unavailable",
    reason: "Mintlify-ready docs.json and MDX drafts are generated locally, but the Mintlify CLI/package is not installed or source-locked in this repo",
  },
  {
    command: "vercel/cloudflare deploy --dry-run",
    status: "unavailable",
    reason: "hosted docs/control-plane deployment target is not selected or authorized",
  },
];

const humanInterventions = [
  "Confirm npm organization/package publishing access for @jami-studio and enable npm provenance/OIDC before any npm publish dry run.",
  "Confirm GitHub release permissions and accepted artifact attestation workflow before creating release artifacts.",
  "Select and authorize the public docs hosting target before Mintlify, Vercel, or Cloudflare claims are made.",
  "Approve publishable package scope changes, including removing private:true and adding publishConfig/files only when packages are ready.",
  "Refresh repo-local source-lock evidence for any release tool, hosted service, protocol, or third-party source used by the release.",
];

const claims = [
  claim("Contract schemas and fixtures exist", "supported", [
    "packages/contracts/schemas",
    "packages/contracts/fixtures",
    "packages/contracts/generated/reference.json",
    "pnpm contracts:generate:check",
    "pnpm contracts:validate",
  ]),
  claim("Local CLI can initialize, run a local evidence smoke, inspect, and verify state", "supported", [
    "apps/cli/src/cli.mjs",
    "apps/cli/test/cli.test.mjs",
    "apps/cli/README.md",
    "pnpm cli:test",
    "pnpm examples:smoke",
  ]),
  claim("Narrow tool gateway foundation supports policy-gated function tools with typed execution evidence", "supported", [
    "packages/tools/src/index.mjs",
    "packages/tools/test/tools.test.mjs",
    "packages/contracts/schemas/tool-execution.schema.json",
    "pnpm tools:test",
    "pnpm contracts:validate",
  ]),
  claim("Tool adapter source inspection reports function and trusted MCP fixture support plus fail-closed OpenAPI, shell, browser, code, provider-as-tool, and A2A dry-run evidence", "supported", [
    "packages/tools/src/index.mjs",
    "packages/tools/test/tools.test.mjs",
    "packages/sdk/src/index.mjs",
    "apps/cli/src/cli.mjs",
    "pnpm tools:test",
    "pnpm sdk:test",
    "pnpm cli:test",
  ]),
  claim("SDK composes current runtime, policy, artifacts, observability, and memory defaults", "supported", [
    "packages/sdk/src/index.mjs",
    "packages/sdk/test/sdk.test.mjs",
    "packages/sdk/README.md",
    "pnpm sdk:test",
  ]),
  claim("Local deterministic provider workflow executes through the SDK, tool gateway, policy, traces, artifacts, checkpoints, and evidence", "supported", [
    "packages/provider-local/src/index.mjs",
    "packages/provider-local/test/provider-local.test.mjs",
    "packages/sdk/test/sdk.test.mjs",
    "apps/cli/test/cli.test.mjs",
    "pnpm provider:test",
    "pnpm sdk:test",
    "pnpm cli:test",
  ]),
  claim("Generated docs, changelog, system map, evidence index, and Mintlify-ready navigation draft exist locally", "supported", [
    "packages/docs/scripts/generate-docs.mjs",
    "docs/generated/docs-source-manifest.json",
    "apps/docs/docs.json",
    "pnpm docs:generate -- --check",
  ]),
  claim("Local SBOM dry-run generation and drift check exist for workspace package manifests", "supported", [
    "scripts/release/generate-sbom.mjs",
    "docs/operations/sbom-source-lock.md",
    "docs/generated/sbom.cdx.json",
    "pnpm sbom:generate",
    "pnpm sbom:check",
  ]),
  claim("Release publishing, hosted Mintlify build, hosted workbench, hosted stores, hosted provider runtime, and executable full MCP/OpenAPI/shell/browser/code/provider-as-tool/A2A adapters are available", "unsupported", [
    "apps/cli/README.md",
    "packages/sdk/README.md",
    "packages/provider-local/README.md",
    "packages/tools/README.md",
    "docs/roadmaps/2026-06-07-jami-harness-production-plan.md",
  ]),
];

const blockerCount = checks.filter((check) => check.status === "blocked" || check.status === "failed").length;
const readiness = {
  schemaVersion: "2026-06-09.release-readiness",
  command: dryRun ? "release:dry-run" : "release:readiness",
  generatedAt: git.commitDate ?? "unknown",
  generatedAtSource: git.commitDate
    ? "git HEAD commit date for deterministic local audit output"
    : "unknown",
  repo: {
    name: "jami-harness",
    root: repoRoot,
    remote: git.remote,
    commit: git.commit,
    ref: git.ref,
  },
  readyToPublish: false,
  dryRun,
  summary: blockerCount === 0
    ? "Release audit surfaces exist, but public publishing remains disabled until human interventions are closed."
    : "Release audit completed with publish-blocking gaps. No external publishing was attempted.",
  packages: manifests.map(({ path, manifest }) => ({
    path,
    name: manifest.name,
    version: manifest.version,
    private: manifest.private === true,
    license: manifest.license,
    repository: manifest.repository?.url,
  })),
  checks,
  publicClaims: claims,
  unavailableCommands,
  humanInterventions,
};

if (json) {
  process.stdout.write(`${JSON.stringify(readiness, null, 2)}\n`);
} else {
  process.stdout.write(formatHuman(readiness));
}

if (strictCheck && blockerCount > 0) {
  process.exit(2);
}

function discoverPackageFiles() {
  const files = ["package.json"];
  for (const base of ["packages", "apps"]) {
    const fullBase = join(repoRoot, base);
    if (!existsSync(fullBase)) continue;
    for (const name of readdirSync(fullBase, { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      const manifest = join(base, name.name, "package.json");
      if (existsSync(join(repoRoot, manifest))) files.push(manifest);
    }
  }
  return files.sort();
}

function checkScript(scriptName, label) {
  const rootManifest = manifests.find((entry) => entry.path === "package.json")?.manifest;
  return rootManifest?.scripts?.[scriptName]
    ? passed(label, { script: scriptName })
    : failed(label, `${scriptName} is missing from root package scripts`);
}

function checkFile(path, label) {
  return existsSync(join(repoRoot, path))
    ? passed(label, { path })
    : failed(label, `${path} is missing`);
}

function checkWorkflow() {
  const path = join(repoRoot, ".github/workflows/manual-check.yml");
  if (!existsSync(path)) return failed("manual workflow verify command", "manual workflow is missing");
  const text = readFileSync(path, "utf8");
  if (!text.includes("pnpm verify")) return failed("manual workflow verify command", "manual workflow does not run pnpm verify");
  if (!text.includes("--frozen-lockfile")) return failed("manual workflow lockfile discipline", "manual workflow does not use frozen lockfile install");
  return passed("manual workflow uses frozen install and pnpm verify");
}

function checkNoTrackedEnv() {
  const tracked = spawnSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" });
  if (tracked.status !== 0) return failed("tracked-file secret boundary", "git ls-files failed");
  const offenders = tracked.stdout
    .split(/\r?\n/)
    .filter((file) => /^(\.env|.*\/\.env)(\.|$)/.test(file) && !file.endsWith(".example"));
  return offenders.length === 0
    ? passed("tracked-file secret boundary", { command: "git ls-files" })
    : failed("tracked-file secret boundary", `tracked env files: ${offenders.join(", ")}`);
}

function checkPackageMetadata() {
  const missing = [];
  for (const { path, manifest } of manifests) {
    if (manifest.license !== "Apache-2.0") missing.push(`${path}: license`);
    if (!manifest.repository?.url) missing.push(`${path}: repository.url`);
    if (!manifest.description) missing.push(`${path}: description`);
  }
  return missing.length === 0
    ? passed("package metadata carries license, repository, and descriptions")
    : failed("package metadata carries license, repository, and descriptions", missing.join("; "));
}

function checkPrivatePublishBlock() {
  const privatePackages = manifests.filter(({ manifest }) => manifest.private === true);
  return {
    label: "package publishing disabled until release gates close",
    status: "blocked",
    reason: `${privatePackages.length}/${manifests.length} package manifests are private:true; this intentionally blocks npm publishing`,
    evidence: privatePackages.map(({ path }) => path),
  };
}

function checkDocsPolicy(section, label) {
  const path = join(repoRoot, "docs/operations/release-readiness.md");
  if (!existsSync(path)) return failed(label, "docs/operations/release-readiness.md is missing");
  const text = readFileSync(path, "utf8");
  return text.includes(`## ${section}`)
    ? passed(label, { path: "docs/operations/release-readiness.md", section })
    : failed(label, `missing section: ${section}`);
}

function gitInfo() {
  return {
    remote: runGit(["remote", "get-url", "origin"]),
    commit: runGit(["rev-parse", "HEAD"]),
    ref: runGit(["rev-parse", "--abbrev-ref", "HEAD"]),
    commitDate: runGit(["log", "-1", "--format=%cI"]),
  };
}

function runGit(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function passed(label, evidence = {}) {
  return { label, status: "passed", evidence };
}

function failed(label, reason) {
  return { label, status: "failed", reason };
}

function claim(claimText, status, evidence) {
  return { claim: claimText, status, evidence };
}

function formatHuman(readiness) {
  const lines = [];
  lines.push(`${readiness.command}: ${readiness.summary}`);
  lines.push(`readyToPublish: ${readiness.readyToPublish}`);
  lines.push("");
  lines.push("Checks:");
  for (const check of readiness.checks) {
    lines.push(`- ${check.status}: ${check.label}${check.reason ? ` - ${check.reason}` : ""}`);
  }
  lines.push("");
  lines.push("Unavailable release commands:");
  for (const command of readiness.unavailableCommands) {
    lines.push(`- ${command.command}: ${command.reason}`);
  }
  lines.push("");
  lines.push("Human interventions:");
  for (const intervention of readiness.humanInterventions) {
    lines.push(`- ${intervention}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}
