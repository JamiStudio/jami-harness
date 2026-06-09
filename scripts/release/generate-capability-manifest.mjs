#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = new Set(process.argv.slice(2));
const check = args.has("--check");
const json = args.has("--json");
const outputPath = "docs/generated/release-capability-manifest.json";
const outputFullPath = join(repoRoot, outputPath);
const sourceLockPath = "docs/operations/release-capability-source-lock.md";
const sourceLockFullPath = join(repoRoot, sourceLockPath);
const command = "pnpm release:capabilities:check";
const generatedAt = "deterministic:git-head-plus-release-capability-input-hash";

const officialSources = [
  source("npm_provenance", "npm provenance statements", "https://docs.npmjs.com/generating-provenance-statements/", [
    "npm publish --provenance requires a supported cloud CI/CD provider, repository metadata, and supported npm CLI.",
    "npm audit signatures verifies downloaded package provenance attestations.",
  ]),
  source("npm_trusted_publishing", "npm trusted publishing", "https://docs.npmjs.com/trusted-publishers/", [
    "Trusted publishing uses OIDC from supported cloud CI/CD providers and can generate provenance automatically for public packages from public repositories.",
    "GitHub trusted publishing requires a configured workflow filename and id-token: write in the workflow.",
  ]),
  source("npm_publish", "npm publish command", "https://docs.npmjs.com/cli/v10/commands/npm-publish/", [
    "npm publish has dry-run and provenance/provenance-file configuration, but publish changes are still gated by manifest and account state.",
    "Package file inclusion must be controlled before any package contents claim.",
  ]),
  source("github_artifact_attestations", "GitHub artifact attestations overview", "https://docs.github.com/en/actions/concepts/security/artifact-attestations", [
    "Artifact attestations establish build provenance and integrity guarantees for release artifacts.",
    "Attestations must be verified to provide consumer value.",
  ]),
  source("github_attest_action", "GitHub artifact attestation workflow", "https://docs.github.com/en/enterprise-cloud@latest/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations", [
    "Generating attestations requires workflow permissions including id-token: write and attestations: write plus actions/attest.",
    "GitHub CLI verification uses gh attestation verify against the artifact and repository.",
  ]),
  source("mintlify_cli", "Mintlify CLI commands", "https://www.mintlify.com/docs/cli/commands", [
    "The current strict local validation command is mint validate.",
    "Mintlify hosted scoring and workflow commands require authenticated hosted project state.",
  ]),
  source("mintlify_docs_json", "Mintlify docs.json settings", "https://www.mintlify.com/docs/organize/settings-reference", [
    "docs.json is the current Mintlify configuration file, with required theme, name, and navigation fields.",
    "Referenced files must stay inside the docs project root.",
  ]),
];

const sourceLockText = existsSync(sourceLockFullPath)
  ? readFileSync(sourceLockFullPath, "utf8")
  : "";
validateSourceLockDoc(sourceLockText);

const git = gitInfo();
const packageFiles = discoverPackageFiles();
const packages = packageFiles.map((path) => ({
  path,
  manifest: JSON.parse(readFileSync(join(repoRoot, path), "utf8")),
}));
const sourceRecords = collectSourceRecords();
const sourceInputHash = hashJson({
  officialSources,
  packageInputs: packages.map(({ path, manifest }) => packageInput(path, manifest)),
  sourceRecords,
});
const privatePackages = packages.filter(({ manifest }) => manifest.private === true);

const manifest = {
  schemaVersion: "2026-06-09.release-capability-manifest",
  sourceRepo: "jami-harness",
  sourceRemote: git.remote ?? "unknown",
  sourceCommit: "git:HEAD",
  sourceRef: git.ref ?? "unknown",
  sourceCommitResolutionCommand: "git rev-parse HEAD",
  sourceInputHash,
  generatedAt,
  command,
  commandResult: "passed",
  freshnessClass: "current-head-official-source-lock",
  packageSummary: {
    packageCount: packages.length,
    privatePackageCount: privatePackages.length,
    publishablePackageCount: packages.length - privatePackages.length,
    packages: packages.map(({ path, manifest }) => ({
      path,
      name: manifest.name,
      version: manifest.version,
      private: manifest.private === true,
      license: manifest.license,
      repository: manifest.repository?.url,
      publishConfig: manifest.publishConfig ?? null,
      files: manifest.files ?? null,
    })),
  },
  officialSources,
  sourceRecords,
  capabilities: buildCapabilities(),
  humanInterventions: [
    "Confirm npm organization/package publishing access for @jami-studio and configure trusted publishing or provenance/OIDC before any npm publish dry run.",
    "Approve publishable package names, package contents policy, files lists, publishConfig, and versioning before removing private:true.",
    "Create and verify a release artifact plus GitHub attestation workflow before claiming signed or attested artifacts.",
    "Install and source-lock the exact Mintlify CLI/package, then run mint validate locally before claiming a Mintlify build check.",
    "Select and authorize a hosted docs target before public docs hosting, Mintlify deployment, Vercel, or Cloudflare claims.",
    "Implement hosted provider, store, and workbench adapters with source-lock evidence and fail-closed fixtures before advertising hosted capability.",
  ],
};

if (check) {
  if (!existsSync(outputFullPath)) {
    fail(`${outputPath} is missing; run pnpm release:capabilities`);
  }
  const existing = readFileSync(outputFullPath, "utf8");
  const expected = `${JSON.stringify(manifest, null, 2)}\n`;
  if (existing !== expected) {
    fail(`${outputPath} is out of date; run pnpm release:capabilities`);
  }
  report({ status: "passed", outputPath, capabilityCount: manifest.capabilities.length, sourceInputHash });
} else {
  mkdirSync(dirname(outputFullPath), { recursive: true });
  writeFileSync(outputFullPath, `${JSON.stringify(manifest, null, 2)}\n`);
  report({ status: "written", outputPath, capabilityCount: manifest.capabilities.length, sourceInputHash });
}

function buildCapabilities() {
  return [
    localCapability({
      capabilityId: "cap_release_readiness_audit",
      surface: "non-publishing release readiness audit",
      safeClaim: "The repo can audit release readiness locally without publishing, tagging, deploying, or calling external account APIs.",
      commands: ["pnpm release:readiness", "pnpm release:dry-run", "pnpm verify"],
      evidence: ["scripts/release/check-readiness.mjs", "docs/operations/release-readiness.md"],
    }),
    localCapability({
      capabilityId: "cap_release_capability_manifest",
      surface: "generated release capability manifest",
      safeClaim: "The repo emits and drift-checks a local manifest for supported and fail-closed release/hosted capability surfaces.",
      commands: ["pnpm release:capabilities", "pnpm release:capabilities:check"],
      evidence: ["scripts/release/generate-capability-manifest.mjs", outputPath, sourceLockPath],
    }),
    localCapability({
      capabilityId: "cap_local_sbom_dry_run",
      surface: "local SBOM dry-run",
      safeClaim: "The repo can generate and check a local CycloneDX workspace package-manifest SBOM dry-run artifact.",
      commands: ["pnpm sbom:generate", "pnpm sbom:check"],
      evidence: ["scripts/release/generate-sbom.mjs", "docs/generated/sbom.cdx.json", "docs/operations/sbom-source-lock.md"],
    }),
    localCapability({
      capabilityId: "cap_local_docs_generation",
      surface: "local generated docs draft",
      safeClaim: "The repo can generate local docs artifacts and a Mintlify-ready docs.json draft, but it has not run Mintlify validation or hosted publishing.",
      commands: ["pnpm docs:generate", "pnpm docs:generate -- --check"],
      evidence: ["packages/docs/scripts/generate-docs.mjs", "apps/docs/docs.json", "docs/generated/docs-source-manifest.json"],
      officialSourceIds: ["mintlify_docs_json"],
    }),
    unsupportedCapability({
      capabilityId: "cap_npm_publish_provenance",
      surface: "npm publish with provenance",
      blockedCommand: "npm publish --dry-run --provenance",
      safeClaim: "npm publishing and provenance are not available from this repo yet.",
      officialSourceIds: ["npm_provenance", "npm_trusted_publishing", "npm_publish"],
      blockers: [
        `${privatePackages.length}/${packages.length} package manifests remain private:true.`,
        "No package files lists or package contents dry-run evidence are recorded.",
        "No npm trusted publisher, OIDC, or automation scope is recorded in this repo.",
        "No publishConfig or accepted package scope/versioning decision is recorded.",
      ],
      requiredBeforeClaim: [
        "Approve package names, files lists, publishConfig, and versioning.",
        "Configure npm trusted publishing or explicit provenance on a supported cloud CI/CD provider.",
        "Run and record a package contents dry run before any npm publish dry run.",
      ],
    }),
    unsupportedCapability({
      capabilityId: "cap_package_contents_dry_run",
      surface: "npm package contents dry run",
      blockedCommand: "npm publish --dry-run or npm pack --dry-run for each publishable package",
      safeClaim: "Package contents have not been dry-run or accepted for public release.",
      officialSourceIds: ["npm_publish"],
      blockers: [
        "Package manifests remain private:true.",
        "No package files lists or publishable package allowlists are accepted.",
        "Research archives and generated/local state boundaries have not been proven against package tarballs.",
      ],
      requiredBeforeClaim: [
        "Add package files lists or equivalent contents policy.",
        "Run a contents dry run for each publishable package and record included files.",
      ],
    }),
    unsupportedCapability({
      capabilityId: "cap_github_release_attestations",
      surface: "GitHub release artifact attestations",
      blockedCommand: "gh attestation verify",
      safeClaim: "Release artifacts are not signed or attested.",
      officialSourceIds: ["github_artifact_attestations", "github_attest_action"],
      blockers: [
        "No release artifact workflow exists.",
        "No artifact subject path, digest, or SBOM attestation input is generated.",
        "No GitHub attestation verification command has been run against a release artifact.",
      ],
      requiredBeforeClaim: [
        "Create a release artifact and workflow using id-token: write and attestations: write.",
        "Generate and verify the attestation with GitHub CLI before claiming attested artifacts.",
      ],
    }),
    unsupportedCapability({
      capabilityId: "cap_mintlify_validate_publish",
      surface: "Mintlify validation and hosted publishing",
      blockedCommand: "mint validate / hosted Mintlify publish",
      safeClaim: "Mintlify-ready files are generated locally, but Mintlify validation and hosted publishing are not available.",
      officialSourceIds: ["mintlify_cli", "mintlify_docs_json"],
      blockers: [
        "Mintlify CLI/package is not installed or source-locked in this repo.",
        "`mint validate` has not run against apps/docs.",
        "No Mintlify project, authentication, or hosted docs target is selected.",
      ],
      requiredBeforeClaim: [
        "Source-lock the exact Mintlify CLI/package.",
        "Install it intentionally and run mint validate locally from the docs project.",
        "Record hosted project authorization before publish/deploy claims.",
      ],
    }),
    unsupportedCapability({
      capabilityId: "cap_hosted_public_docs",
      surface: "hosted public docs",
      blockedCommand: "mintlify/vercel/cloudflare deploy",
      safeClaim: "Public docs hosting is not selected or deployed.",
      officialSourceIds: ["mintlify_cli"],
      blockers: [
        "No hosted docs target is selected.",
        "No account/project authorization evidence is recorded.",
        "No deploy dry run or hosted smoke URL exists.",
      ],
      requiredBeforeClaim: [
        "Select the hosted docs target.",
        "Record account/project authorization and run the target's local/dry-run gate.",
      ],
    }),
    unsupportedCapability({
      capabilityId: "cap_hosted_provider_runtime",
      surface: "hosted provider runtime",
      blockedCommand: "hosted provider model call",
      safeClaim: "Hosted provider execution remains unsupported; only the local deterministic provider is executable.",
      blockers: [
        "No hosted provider adapter source-lock, authentication, redaction, streaming, retry, billing, or policy fixtures exist.",
        "Current unsupported external provider CLI routes return nonzero fail-closed evidence.",
      ],
      requiredBeforeClaim: [
        "Implement a hosted provider adapter behind the model port with auth, policy, trace, redaction, and negative fixtures.",
      ],
    }),
    unsupportedCapability({
      capabilityId: "cap_hosted_durable_stores",
      surface: "hosted durable stores",
      blockedCommand: "hosted store read/write smoke",
      safeClaim: "Hosted stores are not implemented; only local in-memory and filesystem checkpoint stores are available.",
      blockers: [
        "No database/object-store adapter exists.",
        "No hosted store credentials, migration, fixture, or replay evidence exists.",
      ],
      requiredBeforeClaim: [
        "Implement hosted store adapters behind the existing store port and prove fail-closed credential/replay behavior.",
      ],
    }),
    unsupportedCapability({
      capabilityId: "cap_hosted_workbench",
      surface: "hosted workbench",
      blockedCommand: "workbench build/smoke/deploy",
      safeClaim: "No hosted or local workbench app exists in this repo.",
      blockers: [
        "apps/workbench is absent.",
        "Studio UI owns workbench UI primitives and install/config surfaces.",
        "No browser smoke, hosted target, or accessibility evidence exists.",
      ],
      requiredBeforeClaim: [
        "Define the harness-owned workbench contract boundary and integrate Studio UI through published typed contracts before building or hosting a workbench.",
      ],
    }),
  ];
}

function localCapability({ capabilityId, surface, safeClaim, commands, evidence, officialSourceIds = [] }) {
  return {
    capabilityId,
    surface,
    status: "supported_local_evidence",
    claimable: true,
    failClosed: false,
    safeClaim,
    commandEvidence: commands,
    sourceEvidence: evidence,
    officialSourceIds,
    blockers: [],
    requiredBeforeClaim: [],
  };
}

function unsupportedCapability({ capabilityId, surface, blockedCommand, safeClaim, blockers, requiredBeforeClaim, officialSourceIds = [] }) {
  return {
    capabilityId,
    surface,
    status: "fail_closed_unsupported",
    claimable: false,
    failClosed: true,
    blockedCommand,
    safeClaim,
    commandEvidence: [command],
    officialSourceIds,
    blockers,
    requiredBeforeClaim,
  };
}

function validateSourceLockDoc(text) {
  if (!text) fail(`${sourceLockPath} is missing; record official release capability sources before generating the manifest`);
  const missing = officialSources
    .map((entry) => entry.url)
    .filter((url) => !text.includes(url));
  if (missing.length > 0) {
    fail(`${sourceLockPath} is missing official source URLs: ${missing.join(", ")}`);
  }
}

function collectSourceRecords() {
  const files = [
    "package.json",
    "pnpm-workspace.yaml",
    sourceLockPath,
    "docs/operations/release-readiness.md",
    "docs/operations/sbom-source-lock.md",
    "docs/generated/sbom.cdx.json",
    "apps/docs/docs.json",
    "scripts/release/check-readiness.mjs",
    "scripts/release/generate-sbom.mjs",
    "scripts/release/generate-capability-manifest.mjs",
  ];
  files.push(...packageFiles);
  return [...new Set(files)]
    .filter((file) => existsSync(join(repoRoot, file)))
    .sort()
    .map((file) => {
      const text = readFileSync(join(repoRoot, file), "utf8");
      return {
        path: file,
        sha256: sha256(text),
        bytes: Buffer.byteLength(text),
      };
    });
}

function discoverPackageFiles() {
  const files = ["package.json"];
  for (const base of ["packages", "apps"]) {
    const fullBase = join(repoRoot, base);
    if (!existsSync(fullBase)) continue;
    for (const entry of readdirSync(fullBase, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = `${base}/${entry.name}/package.json`;
      if (existsSync(join(repoRoot, path))) files.push(path);
    }
  }
  return [...new Set(files)].sort();
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
  };
}

function source(id, title, url, observations) {
  return {
    id,
    title,
    url,
    official: true,
    verifiedOn: "2026-06-09",
    observations,
  };
}

function gitInfo() {
  return {
    remote: runGit(["remote", "get-url", "origin"]),
    ref: runGit(["rev-parse", "--abbrev-ref", "HEAD"]),
  };
}

function runGit(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
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
    process.stdout.write(`release:capabilities:${payload.status} ${payload.outputPath} capabilities=${payload.capabilityCount} sourceInputHash=${payload.sourceInputHash}\n`);
  }
}

function fail(message) {
  process.stderr.write(`release:capabilities:failed ${message}\n`);
  process.exit(2);
}
