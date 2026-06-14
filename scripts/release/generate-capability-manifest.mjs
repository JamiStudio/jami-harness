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
const productionSourceLockPath = "docs/operations/production-current-source-lock.md";
const productionSourceLockFullPath = join(repoRoot, productionSourceLockPath);
const sbomSourceLockPath = "docs/operations/sbom-source-lock.md";
const sbomSourceLockFullPath = join(repoRoot, sbomSourceLockPath);
const command = "pnpm release:capabilities:check";
const generatedAt = "deterministic:git-head-plus-release-capability-input-hash";
const DEFAULT_PUBLICATION_BRANCH = "main";

const officialSources = [
  source("mcp_2025_11_25", "Model Context Protocol 2025-11-25 specification", "https://modelcontextprotocol.io/specification/2025-11-25", [
    "The official MCP specification identifies 2025-11-25 as the latest version.",
    "Harness MCP support must stay version-pinned and fail closed outside the implemented trusted fixture path.",
  ], "2026-06-14"),
  source("mcp_tools_2025_11_25", "Model Context Protocol tools", "https://modelcontextprotocol.io/specification/2025-11-25/server/tools", [
    "MCP tools are server-exposed callable capabilities with names, descriptions, schemas, and annotations.",
    "Tool metadata remains untrusted input for policy and redaction purposes.",
  ], "2026-06-14"),
  source("shadcn_registry_index", "shadcn registry requirements", "https://ui.shadcn.com/docs/registry/registry-index", [
    "A public shadcn registry is expected to expose flat registry JSON files.",
    "Harness may reference Studio UI registry outputs, but Studio UI owns registry item implementation and hosting.",
  ], "2026-06-14"),
  source("shadcn_registry_item_schema", "shadcn registry item schema", "https://ui.shadcn.com/docs/registry/registry-item-json", [
    "registry-item.json records custom registry item metadata, dependencies, and files.",
    "Harness shared references must remain typed data and must not copy Studio UI registry implementation.",
  ], "2026-06-14"),
  source("openai_agents_sdk", "OpenAI Agents SDK", "https://developers.openai.com/api/docs/guides/agents", [
    "OpenAI Agents SDK docs describe agents as applications that plan, call tools, collaborate across specialists, and maintain state for multi-step work.",
    "Harness-owned orchestration, tool execution, approvals, and state remain product contracts instead of direct SDK assumptions.",
  ], "2026-06-14"),
  source("openai_agents_running", "OpenAI Agents SDK running agents", "https://developers.openai.com/api/docs/guides/agents/running-agents", [
    "Running-agents guidance covers streaming output and conversation-state strategy.",
    "Hosted provider support must not be claimed until the harness has source-locked provider behavior, auth, redaction, tool-call, trace, and recovery fixtures.",
  ], "2026-06-14"),
  source("owasp_llm_top_10_2025", "OWASP Top 10 for LLMs and Gen AI Apps", "https://genai.owasp.org/llm-top-10/", [
    "OWASP's 2025 LLM risk list includes prompt injection, sensitive information disclosure, supply-chain, plugin/tool, and agency risks relevant to harness policy gates.",
    "Security claims must stay backed by fail-closed policy fixtures and redaction evidence.",
  ], "2026-06-14"),
  source("owasp_prompt_injection", "OWASP LLM01:2025 Prompt Injection", "https://genai.owasp.org/llmrisk/llm01-prompt-injection/", [
    "Prompt injection occurs when user prompts alter model behavior or output in unintended ways.",
    "Harness policy and tool metadata handling must treat external instructions as untrusted.",
  ], "2026-06-14"),
  source("npm_provenance", "npm provenance statements", "https://docs.npmjs.com/generating-provenance-statements/", [
    "npm publish --provenance requires a supported cloud CI/CD provider, repository metadata, and supported npm CLI.",
    "npm audit signatures verifies downloaded package provenance attestations.",
  ], "2026-06-14"),
  source("npm_trusted_publishing", "npm trusted publishing", "https://docs.npmjs.com/trusted-publishers/", [
    "Trusted publishing uses OIDC from supported cloud CI/CD providers and can generate provenance automatically for public packages from public repositories.",
    "GitHub trusted publishing requires a configured workflow filename and id-token: write in the workflow.",
  ], "2026-06-14"),
  source("npm_publish", "npm publish command", "https://docs.npmjs.com/cli/v10/commands/npm-publish/", [
    "npm publish has dry-run and provenance/provenance-file configuration, but publish changes are still gated by manifest and account state.",
    "Package file inclusion must be controlled before any package contents claim.",
  ], "2026-06-14"),
  source("github_artifact_attestations", "GitHub artifact attestations overview", "https://docs.github.com/en/actions/concepts/security/artifact-attestations", [
    "Artifact attestations establish build provenance and integrity guarantees for release artifacts.",
    "Attestations must be verified to provide consumer value.",
  ], "2026-06-14"),
  source("github_attest_action", "GitHub artifact attestation workflow", "https://docs.github.com/en/enterprise-cloud@latest/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations", [
    "Generating attestations requires workflow permissions including id-token: write and attestations: write plus actions/attest.",
    "GitHub CLI verification uses gh attestation verify against the artifact and repository.",
  ], "2026-06-14"),
  source("mintlify_cli", "Mintlify CLI commands", "https://www.mintlify.com/docs/cli/commands", [
    "The current strict local validation command is mint validate.",
    "Mintlify hosted scoring and workflow commands require authenticated hosted project state.",
  ]),
  source("mintlify_docs_json", "Mintlify docs.json settings", "https://www.mintlify.com/docs/organize/settings-reference", [
    "docs.json is the current Mintlify configuration file, with required theme, name, colors, and navigation fields.",
    "Referenced files must stay inside the docs project root.",
  ]),
  source("cloudflare_pages_direct_upload", "Cloudflare Pages Direct Upload", "https://developers.cloudflare.com/pages/get-started/direct-upload/", [
    "Cloudflare Pages can deploy a prebuilt static asset folder through Wrangler direct upload or dashboard upload.",
    "The harness route bundle targets the existing registry Cloudflare Pages project under https://registry.jami.studio/harness/ and requires hosted smoke before live claims.",
  ], "2026-06-12"),
  source("cloudflare_pages_headers", "Cloudflare Pages custom headers", "https://developers.cloudflare.com/pages/configuration/headers/", [
    "Cloudflare Pages applies custom response headers from a _headers file in the static asset directory.",
    "Header policy is only a generated preview until the hosted target serves the bundle.",
  ], "2026-06-12"),
  source("neon_connection_string", "Neon connection strings", "https://neon.com/docs/connect/connect-from-any-app", [
    "Neon connection strings include role, password, hostname, and database name.",
    "Hosted store readiness must require secret storage and must never write connection values to generated output.",
  ], "2026-06-12"),
  source("opentelemetry_otlp_exporter", "OpenTelemetry OTLP exporter configuration", "https://opentelemetry.io/docs/languages/sdk-configuration/otlp-exporter/", [
    "OTLP exporter endpoints and headers configure trace, metric, log, and profile export.",
    "Header values can contain API keys and must remain runtime secrets.",
  ], "2026-06-12"),
  source("opentelemetry_env_spec", "OpenTelemetry environment variable specification", "https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/", [
    "OpenTelemetry environment variable behavior is stable except where noted.",
    "Empty environment variables are treated the same as unset values.",
  ], "2026-06-12"),
  source("cyclonedx_spec_overview", "CycloneDX specification overview", "https://cyclonedx.org/specification/overview", [
    "CycloneDX is the selected local SBOM format for the dependency-free workspace package-manifest dry-run artifact.",
    "The generated SBOM remains local evidence until package contents, provenance, and attestations are accepted.",
  ], "2026-06-09"),
  source("cyclonedx_latest_json", "CycloneDX latest JSON reference", "https://cyclonedx.org/docs/latest", [
    "The latest CycloneDX JSON reference identifies the current schema used by the local SBOM source lock.",
    "SBOM schema changes must refresh the local generator and checked artifact together.",
  ], "2026-06-09"),
  source("npm_sbom_command", "npm sbom command", "https://docs.npmjs.com/cli/commands/npm-sbom/", [
    "npm documents an SBOM command that can emit CycloneDX or SPDX.",
    "This repo does not use npm sbom yet because current release tooling is dependency-free and pnpm-based.",
  ], "2026-06-09"),
];

const sourceLockText = existsSync(sourceLockFullPath)
  ? readFileSync(sourceLockFullPath, "utf8")
  : "";
const productionSourceLockText = existsSync(productionSourceLockFullPath)
  ? readFileSync(productionSourceLockFullPath, "utf8")
  : "";
const sbomSourceLockText = existsSync(sbomSourceLockFullPath)
  ? readFileSync(sbomSourceLockFullPath, "utf8")
  : "";
validateSourceLockDoc(`${sourceLockText}\n${productionSourceLockText}\n${sbomSourceLockText}`);

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
const publishablePackages = packages.filter(({ manifest }) => manifest.jamiRelease?.publishable === true);

const manifest = {
  schemaVersion: "2026-06-09.release-capability-manifest",
  sourceRepo: "jami-harness",
  sourceRemote: git.remote ?? "unknown",
  sourceCommit: "git:HEAD",
  sourceRef: git.ref ?? "unknown",
  sourceRefResolution: "pinned-default-publication-branch",
  sourceCommitResolutionCommand: "git rev-parse HEAD",
  sourceInputHash,
  generatedAt,
  command,
  commandResult: "passed",
  freshnessClass: "current-head-official-source-lock",
  packageSummary: {
    packageCount: packages.length,
    privatePackageCount: privatePackages.length,
    publishablePackageCount: publishablePackages.length,
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
  productionAcceptanceMatrix: buildProductionAcceptanceMatrix(),
  humanInterventions: [
    "Confirm npm organization/package publishing access for @jami-studio and configure trusted publishing or provenance/OIDC before any npm publish dry run.",
    "Confirm publishable package names, package contents policy, files lists, publishConfig, public versioning, and trusted publishing workflow before real npm publish.",
    "Create and verify a release artifact plus GitHub attestation workflow before claiming signed or attested artifacts.",
    "Install and source-lock the exact Mintlify CLI/package, then run mint validate locally before claiming a Mintlify build check.",
    "Select and authorize a hosted docs target before public docs hosting, Mintlify deployment, Vercel, or Cloudflare claims.",
    "Implement hosted provider, store, and workbench adapters with source-lock evidence and fail-closed fixtures before advertising hosted capability.",
    "Rerun the harness hosted status/control smoke after any route bundle change before refreshing live route claims.",
    "Provision Neon and OTLP endpoint secrets outside tracked files before claiming hosted store or hosted observability routes.",
  ],
};
validateProductionAcceptanceMatrix(manifest);

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
    localCapability({
      capabilityId: "cap_hosted_status_control_preview_routes",
      surface: "registry-hosted status/control route bundle",
      safeClaim: "The repo generates static JSON routes for harness status, release readiness, and provider/store/observability readiness targeted at https://registry.jami.studio/harness/; the current bundle has hosted smoke evidence for status, release-readiness, and health routes.",
      commands: ["pnpm hosted:routes", "pnpm hosted:routes:check", "JAMI_HARNESS_HOSTED_BASE_URL=https://registry.jami.studio/harness/ pnpm hosted:smoke -- --require-hosted"],
      evidence: [
        "scripts/hosted/generate-hosted-routes.mjs",
        "docs/operations/hosted-route-source-lock.md",
        "docs/generated/hosted-route-manifest.json",
        "apps/workbench/dist/status.json",
        "apps/workbench/dist/release-readiness.json",
        "apps/workbench/dist/provider-store-observability.json",
        "apps/workbench/dist/healthz.json",
        "apps/workbench/dist/_headers",
      ],
      officialSourceIds: [
        "cloudflare_pages_direct_upload",
        "cloudflare_pages_headers",
        "neon_connection_string",
        "opentelemetry_otlp_exporter",
        "opentelemetry_env_spec",
      ],
    }),
    localCapability({
      capabilityId: "cap_package_contents_dry_run",
      surface: "package contents dry run",
      safeClaim: "The repo can dry-run pack every harness-owned publishable package, record included files with SHA-256 hashes, and scan package contents for secret-shaped values without publishing.",
      commands: ["pnpm package:dry-run", "pnpm package:dry-run:check"],
      evidence: ["scripts/release/check-package-contents.mjs", "docs/generated/package-contents-manifest.json"],
      officialSourceIds: ["npm_publish"],
    }),
    localCapability({
      capabilityId: "cap_clean_local_package_install_smoke",
      surface: "clean local tarball install smoke",
      safeClaim: "The repo can pack every harness-owned publishable package, install those tarballs into a clean external npm project, import the public package graph, and run the installed CLI release route.",
      commands: ["pnpm package:smoke", "pnpm package:smoke:check"],
      evidence: ["scripts/release/check-package-contents.mjs", "docs/generated/package-install-smoke.json"],
      officialSourceIds: ["npm_publish"],
    }),
    publicCapability({
      capabilityId: "cap_npm_publish_provenance",
      surface: "npm publish with provenance",
      safeClaim: "Harness packages were published at 0.1.0 through the trusted GitHub Actions package workflow; changed core/SDK/CLI package behavior is prepared for a 0.1.1 provenance patch release.",
      commands: [
        "gh run view 27464403402 --repo studio-jami/jami-harness",
        "npm view @jami-studio/harness-cli@0.1.0",
        "npm view @jami-studio/harness-cli@0.1.1",
      ],
      evidence: [
        "https://github.com/studio-jami/jami-harness/actions/runs/27464403402",
        "docs/generated/package-contents-manifest.json",
        "docs/generated/package-install-smoke.json",
      ],
      officialSourceIds: ["npm_provenance", "npm_trusted_publishing", "npm_publish"],
    }),
    publicCapability({
      capabilityId: "cap_github_release_attestations",
      surface: "GitHub release artifact attestations",
      safeClaim: "The v0.1.0 GitHub Release contains the harness release bundle and checksum, and the bundle attestation verifies against studio-jami/jami-harness.",
      commands: [
        "gh release view v0.1.0 --repo studio-jami/jami-harness",
        "gh attestation verify jami-harness-v0.1.0.tgz --repo studio-jami/jami-harness --format json",
      ],
      evidence: [
        "https://github.com/studio-jami/jami-harness/releases/tag/v0.1.0",
        "https://github.com/studio-jami/jami-harness/actions/runs/27471444596",
        "docs/generated/release-capability-manifest.json",
      ],
      officialSourceIds: ["github_artifact_attestations", "github_attest_action"],
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
      officialSourceIds: ["openai_agents_sdk", "openai_agents_running"],
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
      officialSourceIds: ["neon_connection_string"],
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
      safeClaim: "A local static workbench generator exists, but hosted workbench/control is not implemented or deployed.",
      officialSourceIds: ["cloudflare_pages_direct_upload", "cloudflare_pages_headers"],
      blockers: [
        "apps/workbench is a dependency-free local static shell, not a hosted control plane.",
        "Studio UI owns workbench UI primitives and install/config surfaces.",
        "No hosted target, backend state, deploy smoke, or accessibility evidence exists for a hosted harness workbench.",
      ],
      requiredBeforeClaim: [
        "Define the harness-owned workbench contract boundary and integrate Studio UI through published typed contracts before building or hosting a workbench.",
      ],
    }),
    unsupportedCapability({
      capabilityId: "cap_hosted_observability_sinks",
      surface: "hosted observability sinks",
      blockedCommand: "OTLP export smoke",
      safeClaim: "Hosted observability export remains unsupported; generated route output only records required endpoint and secret actions.",
      officialSourceIds: ["opentelemetry_otlp_exporter", "opentelemetry_env_spec"],
      blockers: [
        "No OTLP endpoint, collector, sink, or secret header storage is configured.",
        "No hosted trace, metric, log, or profile export smoke has run.",
        "Current observability evidence is local deterministic package-test output only.",
      ],
      requiredBeforeClaim: [
        "Configure an OTLP endpoint and secret header resolver outside tracked files.",
        "Run hosted trace and metric export smokes with redacted evidence.",
        "Record failure behavior for missing, empty, malformed, and unauthorized exporter configuration.",
      ],
    }),
  ];
}

function buildProductionAcceptanceMatrix() {
  return [
    acceptanceRow({
      routeId: "route_release_readiness_audit",
      capabilityIds: ["cap_release_readiness_audit", "cap_release_capability_manifest"],
      plannedRoute: "Local non-publishing release readiness and release capability manifest audit.",
      sourceLockRecord: sourceLockPath,
      ownerPackage: "jami-harness",
      verificationCommand: "pnpm release:readiness",
      localGateCommand: "release:readiness",
      evidenceArtifacts: [
        "scripts/release/check-readiness.mjs",
        "scripts/release/generate-capability-manifest.mjs",
        "docs/operations/release-readiness.md",
        "docs/generated/release-capability-manifest.json",
      ],
      implementationPaths: [
        "scripts/release/check-readiness.mjs",
        "scripts/release/generate-capability-manifest.mjs",
      ],
      fixturePaths: [
        "docs/operations/release-readiness.md",
        "docs/generated/release-capability-manifest.json",
      ],
      hostedPublicClaim: "Supported local audit only; it does not publish, tag, deploy, or call external account APIs.",
      supportState: "supported_local_evidence",
      officialSourceIds: ["npm_publish", "npm_provenance", "github_artifact_attestations"],
    }),
    acceptanceRow({
      routeId: "route_local_sbom_dry_run",
      capabilityIds: ["cap_local_sbom_dry_run"],
      plannedRoute: "Local CycloneDX workspace package-manifest SBOM dry-run generation and drift check.",
      sourceLockRecord: sbomSourceLockPath,
      ownerPackage: "jami-harness",
      verificationCommand: "pnpm sbom:check",
      localGateCommand: "sbom:check",
      evidenceArtifacts: [
        "scripts/release/generate-sbom.mjs",
        "docs/generated/sbom.cdx.json",
        "docs/operations/sbom-source-lock.md",
      ],
      implementationPaths: ["scripts/release/generate-sbom.mjs"],
      fixturePaths: ["docs/generated/sbom.cdx.json", "docs/operations/sbom-source-lock.md"],
      hostedPublicClaim: "Supported local SBOM dry-run evidence only; not a package contents SBOM, signed release archive, provenance statement, or attestation.",
      supportState: "supported_local_evidence",
      officialSourceIds: ["cyclonedx_spec_overview", "cyclonedx_latest_json", "npm_sbom_command"],
    }),
    acceptanceRow({
      routeId: "route_mcp_trusted_fixture_tools",
      plannedRoute: "Trusted in-process MCP initialize, tools/list, and tools/call mapping through the policy-gated tool envelope.",
      sourceLockRecord: "docs/operations/mcp-source-lock.md",
      ownerPackage: "@jami-studio/harness-tools",
      verificationCommand: "pnpm tools:test",
      localGateCommand: "tools:test",
      evidenceArtifacts: [
        "packages/tools/src/index.mjs",
        "packages/tools/test/tools.test.mjs",
        "packages/contracts/fixtures/tools/valid-tool-execution-completed.json",
        "packages/contracts/fixtures/policy/valid-policy-decision-deny-mcp-transport-abuse.json",
      ],
      implementationPaths: ["packages/tools/src/index.mjs"],
      fixturePaths: ["packages/tools/test/tools.test.mjs", "packages/contracts/fixtures/tools/valid-tool-execution-completed.json"],
      hostedPublicClaim: "No hosted/public transport claim; local trusted fixture route only.",
      supportState: "supported_local_evidence",
      officialSourceIds: ["mcp_2025_11_25", "mcp_tools_2025_11_25"],
    }),
    acceptanceRow({
      routeId: "route_tool_adapters_fail_closed",
      plannedRoute: "OpenAPI, shell, browser, code, provider-as-tool, A2A, remote MCP, stdio MCP, and MCP resources/prompts/tasks.",
      sourceLockRecord: productionSourceLockPath,
      ownerPackage: "@jami-studio/harness-tools",
      verificationCommand: "pnpm tools:test",
      localGateCommand: "tools:test",
      evidenceArtifacts: ["packages/tools/src/index.mjs", "packages/tools/test/tools.test.mjs"],
      implementationPaths: [],
      fixturePaths: ["packages/tools/test/tools.test.mjs", "packages/contracts/fixtures/tools/valid-tool-execution-unsupported.json"],
      hostedPublicClaim: "Unavailable until source locks, executable adapters, policy fixtures, and evidence packets land.",
      supportState: "fail_closed_unsupported",
      officialSourceIds: ["mcp_2025_11_25", "openai_agents_sdk"],
      blockers: [
        "No executable adapter implementation exists for these external routes.",
        "Only fail-closed unsupported manifests and dry-run evidence are present.",
      ],
      requiredBeforeClaim: [
        "Add route-specific source-lock records.",
        "Implement adapters behind the tool execution envelope.",
        "Add positive, denied, malformed, redacted, trace, audit, and evidence fixtures.",
      ],
    }),
    acceptanceRow({
      routeId: "route_local_deterministic_provider",
      plannedRoute: "Local deterministic provider route for source-checkout and package-smoke evidence runs.",
      sourceLockRecord: productionSourceLockPath,
      ownerPackage: "@jami-studio/harness-provider-local",
      verificationCommand: "pnpm provider:test",
      localGateCommand: "provider:test",
      evidenceArtifacts: ["packages/provider-local/src/index.mjs", "packages/provider-local/test/provider-local.test.mjs"],
      implementationPaths: ["packages/provider-local/src/index.mjs"],
      fixturePaths: ["packages/provider-local/test/provider-local.test.mjs"],
      hostedPublicClaim: "Local package/runtime route only; no hosted model provider claim.",
      supportState: "supported_local_evidence",
      officialSourceIds: [],
    }),
    acceptanceRow({
      routeId: "route_hosted_provider_runtime",
      capabilityIds: ["cap_hosted_provider_runtime"],
      plannedRoute: "Hosted OpenAI/Anthropic/Google/xAI/Azure/Bedrock provider execution with auth, streaming, tools, cost, redaction, retry, and cancellation.",
      sourceLockRecord: productionSourceLockPath,
      ownerPackage: "@jami-studio/harness-provider-hosted",
      verificationCommand: "pnpm provider:test",
      localGateCommand: "provider:test",
      evidenceArtifacts: ["packages/provider-hosted/src/index.mjs", "packages/provider-hosted/test/provider-hosted.test.mjs"],
      implementationPaths: [],
      fixturePaths: ["packages/provider-hosted/test/provider-hosted.test.mjs"],
      hostedPublicClaim: "Unavailable; hosted provider execution must fail closed.",
      supportState: "fail_closed_unsupported",
      officialSourceIds: ["openai_agents_sdk", "openai_agents_running"],
      blockers: [
        "No hosted provider source-lock, auth resolver, streaming, hosted tool-call, usage/cost, or cancellation implementation exists.",
        "Provider-hosted package currently proves fail-closed behavior only.",
      ],
      requiredBeforeClaim: [
        "Select accepted hosted provider routes.",
        "Add current official provider source-lock records.",
        "Implement auth, redaction, policy, trace, retry, cancellation, usage/cost, and negative fixtures.",
      ],
    }),
    acceptanceRow({
      routeId: "route_policy_default_deny_security",
      plannedRoute: "Default-deny policy decisions, secret-reference hygiene, prompt-injection/tool-metadata poisoning denial, replay rejection, and audit evidence.",
      sourceLockRecord: productionSourceLockPath,
      ownerPackage: "@jami-studio/harness-policy",
      verificationCommand: "pnpm policy:test",
      localGateCommand: "policy:test",
      evidenceArtifacts: [
        "packages/policy/src/index.mjs",
        "packages/policy/test/policy.test.mjs",
        "packages/contracts/fixtures/policy/valid-policy-decision-deny-prompt-injection.json",
        "packages/contracts/fixtures/policy/invalid-secret-ref-value-leak.json",
      ],
      implementationPaths: ["packages/policy/src/index.mjs"],
      fixturePaths: [
        "packages/policy/test/policy.test.mjs",
        "packages/contracts/fixtures/policy/valid-policy-decision-deny-prompt-injection.json",
        "packages/contracts/fixtures/policy/invalid-secret-ref-value-leak.json",
      ],
      hostedPublicClaim: "Supported local governance contract; no enterprise policy-engine or hosted SIEM claim.",
      supportState: "supported_local_evidence",
      officialSourceIds: ["owasp_llm_top_10_2025", "owasp_prompt_injection"],
    }),
    acceptanceRow({
      routeId: "route_studio_ui_shared_contract_refs",
      plannedRoute: "Harness-side shared data references for uiPayload, artifactView, actionRef, themeRef, workspaceRef, evidencePacket, memoryRecord, contextPack, and capabilityManifest.",
      sourceLockRecord: productionSourceLockPath,
      ownerPackage: "@jami-studio/harness-contracts",
      verificationCommand: "pnpm contracts:check",
      localGateCommand: "contracts:check",
      evidenceArtifacts: [
        "packages/contracts/schemas/capability-manifest.schema.json",
        "packages/contracts/fixtures/shared-seams/phase2-capability-manifest-states.json",
        "docs/architecture/foundation-alignment.md",
      ],
      implementationPaths: ["packages/contracts/schemas/capability-manifest.schema.json"],
      fixturePaths: ["packages/contracts/fixtures/shared-seams/phase2-capability-manifest-states.json"],
      hostedPublicClaim: "Harness emits typed data only; Studio UI owns registry item implementation and resident rendering.",
      supportState: "supported_local_evidence",
      officialSourceIds: ["shadcn_registry_index", "shadcn_registry_item_schema"],
    }),
    acceptanceRow({
      routeId: "route_local_docs_generation",
      capabilityIds: ["cap_local_docs_generation"],
      plannedRoute: "Local docs generation into repo-owned generated Markdown and Mintlify-ready draft config.",
      sourceLockRecord: sourceLockPath,
      ownerPackage: "@jami-studio/harness-docs",
      verificationCommand: "pnpm docs:generate:check",
      localGateCommand: "docs:generate:check",
      evidenceArtifacts: [
        "packages/docs/scripts/generate-docs.mjs",
        "docs/generated/docs-source-manifest.json",
        "apps/docs/docs.json",
      ],
      implementationPaths: ["packages/docs/scripts/generate-docs.mjs"],
      fixturePaths: ["docs/generated/docs-source-manifest.json", "apps/docs/docs.json"],
      hostedPublicClaim: "Supported local generated docs only; Mintlify validation and hosted docs publishing remain unavailable.",
      supportState: "supported_local_evidence",
      officialSourceIds: ["mintlify_docs_json"],
    }),
    acceptanceRow({
      routeId: "route_mintlify_validate_publish",
      capabilityIds: ["cap_mintlify_validate_publish"],
      plannedRoute: "Mintlify validation, hosted Mintlify build, and hosted docs publishing for generated docs output.",
      sourceLockRecord: sourceLockPath,
      ownerPackage: "@jami-studio/harness-docs",
      verificationCommand: "pnpm docs:generate:check",
      localGateCommand: "docs:generate:check",
      evidenceArtifacts: ["apps/docs/docs.json", "docs/generated/docs-source-manifest.json"],
      implementationPaths: [],
      fixturePaths: ["apps/docs/docs.json", "docs/generated/docs-source-manifest.json"],
      hostedPublicClaim: "Unavailable; Mintlify-ready local files exist, but Mintlify validation/build/publish is not source-locked or run.",
      supportState: "fail_closed_unsupported",
      officialSourceIds: ["mintlify_cli", "mintlify_docs_json"],
      blockers: [
        "The Mintlify CLI/package is not installed or source-locked in this repo.",
        "`mint validate` has not run against apps/docs.",
        "No Mintlify project, authentication, or hosted docs target is selected.",
      ],
      requiredBeforeClaim: [
        "Source-lock the exact Mintlify CLI/package.",
        "Install it intentionally and run mint validate or the accepted current local build check.",
        "Record hosted project authorization and hosted build/publish smoke evidence.",
      ],
    }),
    acceptanceRow({
      routeId: "route_hosted_public_docs",
      capabilityIds: ["cap_hosted_public_docs"],
      plannedRoute: "Hosted public docs on Mintlify, Vercel, Cloudflare, or another selected docs target.",
      sourceLockRecord: sourceLockPath,
      ownerPackage: "@jami-studio/harness-docs",
      verificationCommand: "pnpm docs:generate:check",
      localGateCommand: "docs:generate:check",
      evidenceArtifacts: ["apps/docs/docs.json", "docs/generated/docs-source-manifest.json"],
      implementationPaths: [],
      fixturePaths: ["apps/docs/docs.json", "docs/generated/docs-source-manifest.json"],
      hostedPublicClaim: "Unavailable; public docs hosting is not selected or deployed.",
      supportState: "fail_closed_unsupported",
      officialSourceIds: ["mintlify_cli", "cloudflare_pages_direct_upload"],
      blockers: [
        "No hosted docs target is selected.",
        "No account/project authorization evidence is recorded.",
        "No deploy dry run or hosted docs smoke URL exists.",
      ],
      requiredBeforeClaim: [
        "Select the hosted docs target.",
        "Record account/project authorization and run the target's local/dry-run gate.",
        "Record hosted docs URL smoke evidence before any public docs hosting claim.",
      ],
    }),
    acceptanceRow({
      routeId: "route_package_contents_and_install",
      capabilityIds: ["cap_package_contents_dry_run", "cap_clean_local_package_install_smoke"],
      plannedRoute: "Package contents dry run and clean local tarball install smoke for harness-owned publishable packages.",
      sourceLockRecord: sourceLockPath,
      ownerPackage: "@jami-studio/harness",
      verificationCommand: "pnpm package:smoke:check",
      localGateCommand: "package:smoke:check",
      evidenceArtifacts: [
        "scripts/release/check-package-contents.mjs",
        "docs/generated/package-contents-manifest.json",
        "docs/generated/package-install-smoke.json",
      ],
      implementationPaths: ["scripts/release/check-package-contents.mjs"],
      fixturePaths: ["docs/generated/package-install-smoke.json"],
      hostedPublicClaim: "Supported local install proof and public package smoke evidence for the recorded package set.",
      supportState: "supported_public_evidence",
      officialSourceIds: ["npm_publish"],
    }),
    acceptanceRow({
      routeId: "route_npm_provenance",
      capabilityIds: ["cap_npm_publish_provenance"],
      plannedRoute: "npm package publication through trusted publishing/provenance for accepted public packages.",
      sourceLockRecord: sourceLockPath,
      ownerPackage: "@jami-studio/harness",
      verificationCommand: "pnpm release:capabilities:check",
      localGateCommand: "release:capabilities:check",
      evidenceArtifacts: [
        "https://github.com/studio-jami/jami-harness/actions/runs/27464403402",
        "docs/generated/package-contents-manifest.json",
        "docs/generated/package-install-smoke.json",
      ],
      implementationPaths: ["scripts/release/generate-capability-manifest.mjs"],
      fixturePaths: ["docs/generated/package-install-smoke.json"],
      hostedPublicClaim: "Published package/provenance claim is limited to the versions and workflow evidence recorded in the capability manifest.",
      supportState: "supported_public_evidence",
      officialSourceIds: ["npm_provenance", "npm_trusted_publishing", "npm_publish"],
    }),
    acceptanceRow({
      routeId: "route_github_release_attestation",
      capabilityIds: ["cap_github_release_attestations"],
      plannedRoute: "GitHub release artifact and attestation evidence for the v0.1.0 release bundle.",
      sourceLockRecord: sourceLockPath,
      ownerPackage: "@jami-studio/harness",
      verificationCommand: "pnpm release:capabilities:check",
      localGateCommand: "release:capabilities:check",
      evidenceArtifacts: [
        "https://github.com/studio-jami/jami-harness/releases/tag/v0.1.0",
        "https://github.com/studio-jami/jami-harness/actions/runs/27471444596",
        "docs/generated/release-capability-manifest.json",
      ],
      implementationPaths: ["scripts/release/generate-capability-manifest.mjs"],
      fixturePaths: ["docs/generated/release-capability-manifest.json"],
      hostedPublicClaim: "Release attestation claim is limited to the v0.1.0 bundle evidence recorded in the capability manifest.",
      supportState: "supported_public_evidence",
      officialSourceIds: ["github_artifact_attestations", "github_attest_action"],
    }),
    acceptanceRow({
      routeId: "route_hosted_status_control_static",
      capabilityIds: ["cap_hosted_status_control_preview_routes"],
      plannedRoute: "Static harness status/control routes served from the registry Cloudflare Pages project under /harness/.",
      sourceLockRecord: "docs/operations/hosted-route-source-lock.md",
      ownerPackage: "@jami-studio/harness-workbench",
      verificationCommand: "pnpm hosted:routes:check",
      localGateCommand: "hosted:routes:check",
      evidenceArtifacts: [
        "scripts/hosted/generate-hosted-routes.mjs",
        "docs/generated/hosted-route-manifest.json",
        "apps/workbench/dist/status.json",
        "apps/workbench/dist/release-readiness.json",
        "apps/workbench/dist/provider-store-observability.json",
        "apps/workbench/dist/healthz.json",
      ],
      implementationPaths: ["scripts/hosted/generate-hosted-routes.mjs"],
      fixturePaths: ["docs/generated/hosted-route-manifest.json", "apps/workbench/dist/healthz.json"],
      hostedPublicClaim: "Current public route claim is limited to static status/control JSON on https://registry.jami.studio/harness/ with hosted smoke evidence.",
      supportState: "supported_public_evidence",
      officialSourceIds: ["cloudflare_pages_direct_upload", "cloudflare_pages_headers"],
    }),
    acceptanceRow({
      routeId: "route_hosted_stores_observability_workbench",
      capabilityIds: ["cap_hosted_durable_stores", "cap_hosted_workbench", "cap_hosted_observability_sinks"],
      plannedRoute: "Hosted durable stores, hosted observability sinks, and hosted workbench/control plane.",
      sourceLockRecord: "docs/operations/hosted-route-source-lock.md",
      ownerPackage: "@jami-studio/harness-workbench",
      verificationCommand: "pnpm hosted:routes:check",
      localGateCommand: "hosted:routes:check",
      evidenceArtifacts: ["docs/generated/hosted-route-manifest.json", "apps/workbench/generated/workbench-manifest.json"],
      implementationPaths: [],
      fixturePaths: ["docs/generated/hosted-route-manifest.json"],
      hostedPublicClaim: "Unavailable; generated static readiness routes only name missing secret/account actions.",
      supportState: "fail_closed_unsupported",
      officialSourceIds: ["neon_connection_string", "opentelemetry_otlp_exporter", "opentelemetry_env_spec"],
      blockers: [
        "No hosted database/object-store adapter, OTLP endpoint, collector, secret resolver, or hosted control-plane backend exists.",
        "The workbench is a local static generated shell, not a hosted control plane.",
      ],
      requiredBeforeClaim: [
        "Implement hosted adapters behind the existing store, observability, and workbench seams.",
        "Record secret names without values and run hosted smoke fixtures.",
      ],
    }),
  ];
}

function acceptanceRow({
  routeId,
  capabilityIds = [],
  plannedRoute,
  sourceLockRecord,
  ownerPackage,
  verificationCommand,
  localGateCommand,
  evidenceArtifacts,
  implementationPaths,
  fixturePaths,
  hostedPublicClaim,
  supportState,
  officialSourceIds,
  blockers = [],
  requiredBeforeClaim = [],
}) {
  return {
    routeId,
    capabilityIds,
    plannedRoute,
    sourceLockRecord,
    ownerPackage,
    verificationCommand,
    localGateCommand,
    evidenceArtifacts,
    implementationPaths,
    fixturePaths,
    hostedPublicClaim,
    supportState,
    officialSourceIds,
    blockers,
    requiredBeforeClaim,
  };
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

function publicCapability({ capabilityId, surface, safeClaim, commands, evidence, officialSourceIds = [] }) {
  return {
    capabilityId,
    surface,
    status: "supported_public_evidence",
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

function validateProductionAcceptanceMatrix(manifest) {
  const scripts = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).scripts ?? {};
  const packageNames = new Set(manifest.packageSummary.packages.map((entry) => entry.name));
  const sourceIds = new Set(manifest.officialSources.map((entry) => entry.id));
  const capabilityIds = new Set(manifest.capabilities.map((entry) => entry.capabilityId));
  const knownSupportStates = new Set(["supported_local_evidence", "supported_public_evidence", "fail_closed_unsupported"]);
  const requiredRouteIds = new Set([
    "route_release_readiness_audit",
    "route_local_sbom_dry_run",
    "route_mcp_trusted_fixture_tools",
    "route_tool_adapters_fail_closed",
    "route_local_deterministic_provider",
    "route_hosted_provider_runtime",
    "route_policy_default_deny_security",
    "route_studio_ui_shared_contract_refs",
    "route_local_docs_generation",
    "route_mintlify_validate_publish",
    "route_hosted_public_docs",
    "route_package_contents_and_install",
    "route_npm_provenance",
    "route_github_release_attestation",
    "route_hosted_status_control_static",
    "route_hosted_stores_observability_workbench",
  ]);
  const rows = manifest.productionAcceptanceMatrix;
  if (!Array.isArray(rows) || rows.length === 0) {
    fail("production acceptance matrix is missing");
  }
  const seen = new Set();
  const coveredCapabilityIds = new Set();
  for (const row of rows) {
    if (!row.routeId || seen.has(row.routeId)) {
      fail(`production acceptance matrix has a missing or duplicate route id: ${row.routeId ?? "<missing>"}`);
    }
    seen.add(row.routeId);
    for (const capabilityId of row.capabilityIds ?? []) {
      if (!capabilityIds.has(capabilityId)) {
        fail(`${row.routeId} references unknown capability id: ${capabilityId}`);
      }
      if (coveredCapabilityIds.has(capabilityId)) {
        fail(`capability id is covered by more than one production route: ${capabilityId}`);
      }
      coveredCapabilityIds.add(capabilityId);
    }
    if (!requiredRouteIds.has(row.routeId)) {
      fail(`production acceptance matrix has an unexpected route id: ${row.routeId}`);
    }
    if (!packageNames.has(row.ownerPackage)) {
      fail(`${row.routeId} owner package does not exist in package inventory: ${row.ownerPackage}`);
    }
    if (!row.sourceLockRecord || !artifactExists(row.sourceLockRecord)) {
      fail(`${row.routeId} source-lock record is missing: ${row.sourceLockRecord}`);
    }
    if (!row.localGateCommand || !scripts[row.localGateCommand]) {
      fail(`${row.routeId} local gate command is not a package script: ${row.localGateCommand}`);
    }
    if (!row.verificationCommand || row.verificationCommand !== `pnpm ${row.localGateCommand}`) {
      fail(`${row.routeId} verification command must be the pnpm form of localGateCommand`);
    }
    if (!row.hostedPublicClaim) {
      fail(`${row.routeId} hosted/public claim boundary is missing`);
    }
    if (!knownSupportStates.has(row.supportState)) {
      fail(`${row.routeId} has unknown support state: ${row.supportState}`);
    }
    for (const id of row.officialSourceIds ?? []) {
      if (!sourceIds.has(id)) fail(`${row.routeId} references unknown official source id: ${id}`);
    }
    for (const artifact of row.evidenceArtifacts ?? []) {
      if (!artifactExists(artifact)) fail(`${row.routeId} evidence artifact is missing: ${artifact}`);
    }
    for (const fixture of row.fixturePaths ?? []) {
      if (!artifactExists(fixture)) fail(`${row.routeId} fixture/evidence path is missing: ${fixture}`);
    }
    if (row.supportState?.startsWith("supported_")) {
      if (!row.implementationPaths?.length) fail(`${row.routeId} claims support without implementation paths`);
      if (!row.fixturePaths?.length) fail(`${row.routeId} claims support without fixture/evidence paths`);
      if (!row.evidenceArtifacts?.length) fail(`${row.routeId} claims support without evidence artifacts`);
      if (!row.verificationCommand) fail(`${row.routeId} claims support without a verification command`);
      for (const implementation of row.implementationPaths) {
        if (!artifactExists(implementation)) fail(`${row.routeId} implementation path is missing: ${implementation}`);
      }
    } else if (row.supportState === "fail_closed_unsupported") {
      if (!row.blockers?.length) fail(`${row.routeId} is fail-closed without blockers`);
      if (!row.requiredBeforeClaim?.length) fail(`${row.routeId} is fail-closed without requiredBeforeClaim`);
    }
  }
  const missingRoutes = [...requiredRouteIds].filter((routeId) => !seen.has(routeId));
  if (missingRoutes.length > 0) {
    fail(`production acceptance matrix is missing required route ids: ${missingRoutes.join(", ")}`);
  }
  const uncoveredCapabilities = [...capabilityIds].filter((capabilityId) => !coveredCapabilityIds.has(capabilityId));
  if (uncoveredCapabilities.length > 0) {
    fail(`production acceptance matrix is missing capability coverage for: ${uncoveredCapabilities.join(", ")}`);
  }
}

function artifactExists(artifact) {
  if (/^https?:\/\//.test(artifact)) return true;
  return existsSync(join(repoRoot, artifact));
}

function collectSourceRecords() {
  const files = [
    "package.json",
    "pnpm-workspace.yaml",
    sourceLockPath,
    productionSourceLockPath,
    "docs/operations/release-readiness.md",
    "docs/operations/sbom-source-lock.md",
    "docs/generated/sbom.cdx.json",
    "apps/docs/docs.json",
    "scripts/release/check-readiness.mjs",
    "scripts/release/check-package-contents.mjs",
    "scripts/release/generate-sbom.mjs",
    "scripts/release/generate-capability-manifest.mjs",
    "docs/generated/package-contents-manifest.json",
    "docs/generated/package-install-smoke.json",
    "scripts/hosted/generate-hosted-routes.mjs",
    "docs/operations/hosted-route-source-lock.md",
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

function source(id, title, url, observations, verifiedOn = "2026-06-09") {
  return {
    id,
    title,
    url,
    official: true,
    verifiedOn,
    observations,
  };
}

function gitInfo() {
  return {
    remote: normalizeRemote(runGit(["remote", "get-url", "origin"])),
    ref: normalizeRef(),
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
  return DEFAULT_PUBLICATION_BRANCH;
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
