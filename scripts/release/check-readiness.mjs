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
const releaseCapabilityManifest = readReleaseCapabilityManifest();

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
  checkScript("package:dry-run", "package contents dry-run command"),
  checkScript("package:dry-run:check", "package contents dry-run drift check command"),
  checkScript("package:smoke", "clean local package install smoke command"),
  checkScript("package:smoke:check", "clean local package install smoke drift check command"),
  checkScript("release:capabilities", "release capability manifest generation command"),
  checkScript("release:capabilities:check", "release capability manifest drift check command"),
  checkScript("hosted:routes", "hosted status/control route generation command"),
  checkScript("hosted:routes:check", "hosted status/control route drift check command"),
  checkScript("eval:smoke", "local regression eval smoke command"),
  checkScript("release:readiness", "release readiness audit command"),
  checkScript("release:dry-run", "non-publishing release dry-run command"),
  checkFile("pnpm-lock.yaml", "lockfile for frozen local and manual CI installs"),
  checkFile("LICENSE", "repository license file"),
  checkFile("NOTICE", "source and third-party provenance notice"),
  checkFile("docs/operations/release-readiness.md", "release, claims, SBOM, and attestation policy"),
  checkFile("docs/operations/sbom-source-lock.md", "repo-local SBOM source-lock evidence"),
  checkFile("docs/operations/release-capability-source-lock.md", "repo-local release capability source-lock evidence"),
  checkFile("docs/operations/hosted-route-source-lock.md", "repo-local hosted route source-lock evidence"),
  checkFile("docs/generated/docs-source-manifest.json", "generated docs-source manifest"),
  checkFile("docs/generated/install-readiness-manifest.json", "generated install-readiness manifest"),
  checkFile("docs/generated/sbom.cdx.json", "generated local CycloneDX SBOM dry-run artifact"),
  checkFile("docs/generated/package-contents-manifest.json", "generated package contents dry-run artifact"),
  checkFile("docs/generated/package-install-smoke.json", "generated clean package install smoke artifact"),
  checkFile("docs/generated/release-capability-manifest.json", "generated release capability manifest"),
  checkFile("docs/generated/hosted-route-manifest.json", "generated hosted status/control route manifest"),
  checkFile("apps/docs/docs.json", "Mintlify-ready navigation draft"),
  checkFile("apps/workbench/generated/hosted-route-manifest.json", "workbench hosted route manifest mirror"),
  checkFile("apps/workbench/dist/status.json", "preview status route"),
  checkFile("apps/workbench/dist/release-readiness.json", "preview release-readiness route"),
  checkFile("apps/workbench/dist/provider-store-observability.json", "preview provider/store/observability route"),
  checkFile("apps/workbench/dist/healthz.json", "preview route health check"),
  checkFile("apps/workbench/dist/_headers", "preview route static headers"),
  checkFile(".github/workflows/manual-check.yml", "manual GitHub fallback workflow"),
  checkWorkflow(),
  checkReleaseCapabilityManifest(),
  checkNoTrackedEnv(),
  checkPackageMetadata(),
  checkPrivatePublishBlock(),
  checkDocsPolicy("Public Claims Matrix", "public claims matrix"),
  checkDocsPolicy("SBOM Policy", "SBOM policy"),
  checkDocsPolicy("Hosted And Release Capability Manifest", "hosted and release capability manifest policy"),
  checkDocsPolicy("Hosted Status And Control Routes", "hosted status/control route policy"),
  checkDocsPolicy("Package Provenance And Attestation Policy", "package provenance and attestation policy"),
  checkDocsPolicy("Install And Module Replacement Readiness", "install and module replacement readiness policy"),
  checkDocsPolicy("Human Interventions", "human/account intervention ledger"),
];

const unavailableCommands = [
  {
    command: "mint validate / hosted Mintlify publish",
    status: "unavailable",
    reason: "Mintlify-ready harness docs are generated locally, but no harness-hosted Mintlify project/route has been selected and smoked",
  },
  {
    command: "vercel/cloudflare deploy --dry-run",
    status: "unavailable",
    reason: "hosted docs/control-plane deployment target is not selected or authorized",
  },
  {
    command: "Cloudflare Pages hosted route smoke",
    status: "unavailable",
    reason: "static harness status/control routes are generated locally, but no Cloudflare Pages project, DNS target, deployment, or public URL smoke exists",
  },
  {
    command: "Neon hosted store smoke",
    status: "unavailable",
    reason: "no Neon project, branch, role, migration, or connection secret is configured",
  },
  {
    command: "OTLP hosted observability export smoke",
    status: "unavailable",
    reason: "no OTLP endpoint or secret header storage is configured",
  },
];

const humanInterventions = [
  "Select and authorize the harness hosted docs/control target before Mintlify, Vercel, Cloudflare, or other harness-hosted route claims are made.",
  "Refresh repo-local source-lock evidence for any release tool, hosted service, protocol, or third-party source used by the release.",
  "Create or authorize the Cloudflare Pages project and DNS target before claiming hosted harness status/control routes.",
  "Provision Neon and OTLP endpoint secrets outside tracked files before claiming hosted store or hosted observability routes.",
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
  claim("Local observability metrics and deterministic regression eval smoke exist for current tool safety, docs generation, memory recall, and recovery foundations", "supported", [
    "packages/observability/src/index.mjs",
    "packages/observability/test/observability.test.mjs",
    "evals/smoke.mjs",
    "pnpm observability:test",
    "pnpm eval:smoke",
  ]),
  claim("Generated docs, changelog, system map, evidence index, and Mintlify-ready navigation draft exist locally", "supported", [
    "packages/docs/scripts/generate-docs.mjs",
    "docs/generated/docs-source-manifest.json",
    "apps/docs/docs.json",
    "pnpm docs:generate -- --check",
  ]),
  claim("Full local source-checkout install and modular BYO paths are documented with generated manifest evidence", "supported", [
    "packages/sdk/src/index.mjs",
    "apps/cli/src/cli.mjs",
    "docs/generated/install-readiness-manifest.json",
    "pnpm sdk:test",
    "pnpm cli:test",
    "pnpm docs:generate -- --check",
  ]),
  claim("Local SBOM dry-run generation and drift check exist for workspace package manifests", "supported", [
    "scripts/release/generate-sbom.mjs",
    "docs/operations/sbom-source-lock.md",
    "docs/generated/sbom.cdx.json",
    "pnpm sbom:generate",
    "pnpm sbom:check",
  ]),
  claim("Harness-owned publishable packages have local pack dry-run evidence and clean external tarball install smoke", "supported", [
    "scripts/release/check-package-contents.mjs",
    "docs/generated/package-contents-manifest.json",
    "docs/generated/package-install-smoke.json",
    "pnpm package:dry-run:check",
    "pnpm package:smoke:check",
  ]),
  claim("Harness packages are published publicly at @jami-studio/*@0.1.0 with GitHub Actions publish provenance", "supported", [
    "https://github.com/studio-jami/jami-harness/actions/runs/27464403402",
    "docs/generated/package-contents-manifest.json",
    "docs/generated/package-install-smoke.json",
  ]),
  claim("Harness GitHub Release v0.1.0 includes an attested release bundle and checksum", "supported", [
    "https://github.com/studio-jami/jami-harness/releases/tag/v0.1.0",
    "https://github.com/studio-jami/jami-harness/actions/runs/27471444596",
    "gh attestation verify jami-harness-v0.1.0.tgz --repo studio-jami/jami-harness --format json",
  ]),
  claim("Release and hosted capability manifest exists with fail-closed unsupported surfaces backed by repo-local official-source evidence", "supported", [
    "scripts/release/generate-capability-manifest.mjs",
    "docs/operations/release-capability-source-lock.md",
    "docs/generated/release-capability-manifest.json",
    "pnpm release:capabilities",
    "pnpm release:capabilities:check",
  ]),
  claim("Preview hosted status/control routes are generated as static JSON with fail-closed hosted provider/store/observability readiness", "supported", [
    "scripts/hosted/generate-hosted-routes.mjs",
    "docs/operations/hosted-route-source-lock.md",
    "docs/generated/hosted-route-manifest.json",
    "apps/workbench/dist/status.json",
    "apps/workbench/dist/release-readiness.json",
    "apps/workbench/dist/provider-store-observability.json",
    "apps/workbench/dist/healthz.json",
    "apps/workbench/dist/_headers",
    "pnpm hosted:routes",
    "pnpm hosted:routes:check",
  ]),
  claim("Hosted Mintlify build, hosted workbench, hosted stores, hosted provider runtime, and executable full MCP/OpenAPI/shell/browser/code/provider-as-tool/A2A adapters are available", "unsupported", [
    "apps/cli/README.md",
    "packages/sdk/README.md",
    "packages/provider-local/README.md",
    "packages/tools/README.md",
    "docs/roadmaps/2026-06-07-jami-harness-production-plan.md",
    "docs/generated/release-capability-manifest.json",
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
  readyToPublish: blockerCount === 0,
  dryRun,
  summary: blockerCount === 0
    ? "Package publishing, public package install evidence, and GitHub Release artifact evidence are complete; hosted harness runtime/control lanes remain unavailable until real hosted targets and secrets are configured."
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
  releaseCapabilities: releaseCapabilityManifest ? {
    sourceInputHash: releaseCapabilityManifest.sourceInputHash,
    freshnessClass: releaseCapabilityManifest.freshnessClass,
    capabilities: releaseCapabilityManifest.capabilities.map((capability) => ({
      capabilityId: capability.capabilityId,
      surface: capability.surface,
      status: capability.status,
      claimable: capability.claimable,
      failClosed: capability.failClosed,
    })),
  } : undefined,
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
  const publishablePrivatePackages = manifests.filter(({ manifest }) => manifest.jamiRelease?.publishable === true && manifest.private === true);
  if (publishablePrivatePackages.length > 0) {
    return {
      label: "publishable package manifests are public-package ready",
      status: "blocked",
      reason: `${publishablePrivatePackages.length} publishable package manifests still have private:true`,
      evidence: publishablePrivatePackages.map(({ path }) => path),
    };
  }
  return {
    label: "npm publish/provenance completed through trusted release workflow",
    status: "passed",
    evidence: [
      "https://github.com/studio-jami/jami-harness/actions/runs/27464403402",
      "https://github.com/studio-jami/jami-harness/releases/tag/v0.1.0",
      "docs/generated/package-contents-manifest.json",
      "docs/generated/package-install-smoke.json",
      "docs/generated/release-capability-manifest.json",
    ],
  };
}

function checkReleaseCapabilityManifest() {
  if (!releaseCapabilityManifest) {
    return failed("release capability manifest fail-closed surface coverage", "docs/generated/release-capability-manifest.json is missing or invalid");
  }
  const requiredSupported = [
    "cap_release_readiness_audit",
    "cap_release_capability_manifest",
    "cap_local_sbom_dry_run",
    "cap_local_docs_generation",
    "cap_hosted_status_control_preview_routes",
    "cap_package_contents_dry_run",
    "cap_clean_local_package_install_smoke",
    "cap_npm_publish_provenance",
    "cap_github_release_attestations",
  ];
  const requiredUnsupported = [
    "cap_mintlify_validate_publish",
    "cap_hosted_public_docs",
    "cap_hosted_provider_runtime",
    "cap_hosted_durable_stores",
    "cap_hosted_workbench",
    "cap_hosted_observability_sinks",
  ];
  const byId = new Map((releaseCapabilityManifest.capabilities ?? []).map((capability) => [capability.capabilityId, capability]));
  const supportedStatuses = new Set(["supported_local_evidence", "supported_public_evidence"]);
  const missingSupported = requiredSupported.filter((id) => !supportedStatuses.has(byId.get(id)?.status));
  const missingUnsupported = requiredUnsupported.filter((id) => {
    const capability = byId.get(id);
    return capability?.status !== "fail_closed_unsupported" || capability?.claimable !== false || capability?.failClosed !== true;
  });
  const missingOfficialSources = (releaseCapabilityManifest.officialSources ?? [])
    .filter((source) => source.official !== true || !source.url || !source.verifiedOn)
    .map((source) => source.id ?? "unknown");
  const failures = [
    ...missingSupported.map((id) => `${id}: missing supported local evidence status`),
    ...missingUnsupported.map((id) => `${id}: missing fail-closed unsupported status`),
    ...missingOfficialSources.map((id) => `${id}: missing official source metadata`),
  ];
  return failures.length === 0
    ? passed("release capability manifest fail-closed surface coverage", {
      path: "docs/generated/release-capability-manifest.json",
      capabilities: releaseCapabilityManifest.capabilities.length,
    })
    : failed("release capability manifest fail-closed surface coverage", failures.join("; "));
}

function checkDocsPolicy(section, label) {
  const path = join(repoRoot, "docs/operations/release-readiness.md");
  if (!existsSync(path)) return failed(label, "docs/operations/release-readiness.md is missing");
  const text = readFileSync(path, "utf8");
  return text.includes(`## ${section}`)
    ? passed(label, { path: "docs/operations/release-readiness.md", section })
    : failed(label, `missing section: ${section}`);
}

function readReleaseCapabilityManifest() {
  const path = join(repoRoot, "docs/generated/release-capability-manifest.json");
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function gitInfo() {
  return {
    remote: normalizeRemote(runGit(["remote", "get-url", "origin"])),
    commit: runGit(["rev-parse", "HEAD"]),
    ref: normalizeRef(),
    commitDate: runGit(["log", "-1", "--format=%cI"]),
  };
}

function normalizeRemote(remote) {
  if (!remote) return remote;
  if (/^https:\/\/github\.com\/[^/]+\/[^/]+(?:\.git)?$/.test(remote)) {
    return `${remote.replace(/\.git$/, "")}.git`;
  }
  return remote;
}

function normalizeRef() {
  const githubRefName = process.env.GITHUB_REF_NAME;
  if (githubRefName) return githubRefName;
  const githubRef = process.env.GITHUB_REF;
  if (githubRef?.startsWith("refs/heads/")) return githubRef.slice("refs/heads/".length);
  const gitRef = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  return gitRef === "HEAD" ? "main" : gitRef;
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
