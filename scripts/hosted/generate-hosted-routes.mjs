#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = new Set(process.argv.slice(2));
const check = args.has("--check");
const json = args.has("--json");
const manifestPath = "docs/generated/hosted-route-manifest.json";
const sourceLockPath = "docs/operations/hosted-route-source-lock.md";
const generatedAt = "deterministic:git-head-plus-hosted-route-input-hash";
const command = "pnpm hosted:routes:check";
const publicHarnessBaseUrl = "https://registry.jami.studio/harness/";
const DEFAULT_PUBLICATION_BRANCH = "main";

const officialSources = [
  source("cloudflare_pages_direct_upload", "Cloudflare Pages Direct Upload", "https://developers.cloudflare.com/pages/get-started/direct-upload/", [
    "Cloudflare Pages can upload a prebuilt asset folder through Wrangler or dashboard drag and drop.",
    "Wrangler direct upload accepts a single folder of built assets.",
  ]),
  source("cloudflare_pages_headers", "Cloudflare Pages custom headers", "https://developers.cloudflare.com/pages/configuration/headers/", [
    "Cloudflare Pages applies custom headers from a plain _headers file placed in the static asset directory.",
  ]),
  source("neon_connection_string", "Neon connection strings", "https://neon.com/docs/connect/connect-from-any-app", [
    "Neon application connections require connection details from a Neon project and branch.",
    "Neon connection strings include role, password, hostname, and database name, so they must not be committed.",
  ]),
  source("opentelemetry_otlp_exporter", "OpenTelemetry OTLP exporter configuration", "https://opentelemetry.io/docs/languages/sdk-configuration/otlp-exporter/", [
    "OTLP exporters use endpoint variables for traces, metrics, logs, and profiles.",
    "OTLP headers can carry API keys and must not be written to generated route output.",
  ]),
  source("opentelemetry_env_spec", "OpenTelemetry environment variable specification", "https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/", [
    "The OpenTelemetry environment variable specification is stable except where noted.",
    "Empty environment variable values are interpreted the same as unset values.",
  ]),
];

validateSourceLockDoc();

const releaseCapabilities = readJson("docs/generated/release-capability-manifest.json");
const docsSource = readJson("docs/generated/docs-source-manifest.json");
const installReadiness = readJson("docs/generated/install-readiness-manifest.json");
const sbom = readJson("docs/generated/sbom.cdx.json");
const git = gitInfo();
const sourceRecords = collectSourceRecords();
const sourceInputHash = hashJson({
  officialSources,
  sourceRecords,
  releaseCapabilityHash: releaseCapabilities.sourceInputHash,
  docsSourceHash: docsSource.sourceInputHash,
  installReadinessHash: installReadiness.sourceInputHash,
});

const manifest = {
  schemaVersion: "2026-06-12.hosted-route-manifest",
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
  routeBase: {
    localDirectory: "apps/workbench/dist",
    previewServeCommand: "npx serve apps/workbench/dist",
    intendedHostedTarget: "Existing registry Cloudflare Pages project served from the /harness/ path",
    publicUrl: publicHarnessBaseUrl,
    publicUrlStatus: "live_smoke_passed",
    publicSmokeCommand: "JAMI_HARNESS_HOSTED_BASE_URL=https://registry.jami.studio/harness/ pnpm hosted:smoke -- --require-hosted",
    publicSmokeVerifiedOn: "2026-06-13",
  },
  officialSources,
  routes: buildRoutes(),
  humanInterventions: [
    "Rerun JAMI_HARNESS_HOSTED_BASE_URL=https://registry.jami.studio/harness/ pnpm hosted:smoke -- --require-hosted after changes to the harness status/control route bundle.",
    "Provision a Neon project, branch, role, migration path, and secret storage for the hosted store adapter before hosted-store claims.",
    "Provision hosted provider credentials and secret references for each accepted provider adapter before hosted-provider claims.",
    "Provision an OTLP endpoint and secret header storage before hosted observability export claims.",
    "Run a hosted smoke against the final public URLs and record cache, integrity, and secret-scan evidence before saying routes are live.",
  ],
  secretPolicy: {
    generatedRoutesContainSecrets: false,
    blockedSecretFields: ["DATABASE_URL", "NEON_DATABASE_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OTEL_EXPORTER_OTLP_HEADERS"],
    scan: "generated route files are checked for common token, password, credential, signed URL, and API-key markers",
  },
};

const outputs = [
  out(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`),
  out("apps/workbench/generated/hosted-route-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`),
  out("apps/workbench/dist/status.json", `${JSON.stringify(routeById("status"), null, 2)}\n`),
  out("apps/workbench/dist/release-readiness.json", `${JSON.stringify(routeById("release-readiness"), null, 2)}\n`),
  out("apps/workbench/dist/provider-store-observability.json", `${JSON.stringify(routeById("provider-store-observability"), null, 2)}\n`),
  out("apps/workbench/dist/healthz.json", `${JSON.stringify(routeById("healthz"), null, 2)}\n`),
  out("apps/workbench/dist/_headers", headersFile()),
];

validateRouteOutputs(outputs);

const changed = writeOrCheck(outputs, check);
if (check && changed.length > 0) {
  for (const file of changed) console.error(`hosted:routes:stale ${file}`);
  process.exit(1);
}

report({
  status: check ? "passed" : "written",
  outputPath: manifestPath,
  routeCount: manifest.routes.length,
  sourceInputHash,
});

function buildRoutes() {
  return [
    {
      routeId: "status",
      path: "/status.json",
      outputPath: "apps/workbench/dist/status.json",
      method: "GET",
      contentType: "application/json",
      status: "supported_public_hosted_static",
      claimable: true,
      failClosed: true,
      safeClaim: "The static harness status route is hosted at https://registry.jami.studio/harness/status.json and has public hosted smoke evidence for the current generated bundle.",
      evidence: {
        sourceCommit: "git:HEAD",
        docsSourceManifest: {
          path: "docs/generated/docs-source-manifest.json",
          sourceInputHash: docsSource.sourceInputHash,
          generatedOutputCount: docsSource.generatedOutputPaths?.length ?? 0,
        },
        releaseCapabilityManifest: {
          path: "docs/generated/release-capability-manifest.json",
          sourceInputHash: releaseCapabilities.sourceInputHash,
          capabilityCount: releaseCapabilities.capabilities?.length ?? 0,
        },
      },
      readiness: [
        state("local_static_route_generation", "supported_local_evidence", "Generated route files can be checked without a hosted account."),
        state("public_cloudflare_pages_deploy", "supported_public_evidence", "The route bundle is served by the existing registry Cloudflare Pages project under /harness/."),
        state("hosted_smoke", "supported_public_evidence", "The public URL passed pnpm hosted:smoke -- --require-hosted on 2026-06-13."),
      ],
      requiredBeforePublicClaim: [
        "Rerun hosted smoke after any route bundle change before refreshing the live claim.",
      ],
    },
    {
      routeId: "release-readiness",
      path: "/release-readiness.json",
      outputPath: "apps/workbench/dist/release-readiness.json",
      method: "GET",
      contentType: "application/json",
      status: "supported_public_hosted_static",
      claimable: true,
      failClosed: true,
      safeClaim: "A static release-readiness route is hosted from release manifests; public npm provenance and GitHub release attestations are supported, while hosted docs remain blocked.",
      evidence: {
        packagePublishing: capabilityState("cap_npm_publish_provenance"),
        packageContents: capabilityState("cap_package_contents_dry_run"),
        attestations: capabilityState("cap_github_release_attestations"),
        hostedDocs: capabilityState("cap_hosted_public_docs"),
        sbom: {
          path: "docs/generated/sbom.cdx.json",
          bomFormat: sbom.bomFormat,
          specVersion: sbom.specVersion,
          componentCount: sbom.components?.length ?? 0,
        },
      },
      readiness: [
        state("local_release_readiness_audit", "supported_local_evidence", "Release readiness and dry-run audits are supported."),
        state("npm_publish", "supported_public_evidence", "Harness packages are published at 0.1.0 with trusted GitHub Actions provenance evidence."),
        state("github_attestation", "supported_public_evidence", "The v0.1.0 release bundle attestation verifies against studio-jami/jami-harness."),
        state("hosted_smoke_command", "supported_configurable_evidence", "pnpm hosted:smoke verifies local static routes and can require a configured public base URL."),
      ],
      requiredBeforePublicClaim: [
        "Record public docs URL evidence before hosted docs claims.",
        "Run pnpm hosted:smoke -- --require-hosted with the final public harness base URL before hosted route claims.",
      ],
    },
    {
      routeId: "provider-store-observability",
      path: "/provider-store-observability.json",
      outputPath: "apps/workbench/dist/provider-store-observability.json",
      method: "GET",
      contentType: "application/json",
      status: "supported_public_hosted_static",
      claimable: true,
      failClosed: true,
      safeClaim: "A static readiness route enumerates hosted provider, Neon store, and OTLP observability prerequisites; the hosted services are not live.",
      evidence: {
        hostedProviderRuntime: capabilityState("cap_hosted_provider_runtime"),
        hostedDurableStores: capabilityState("cap_hosted_durable_stores"),
        hostedWorkbench: capabilityState("cap_hosted_workbench"),
      },
      readiness: [
        state("hosted_provider_runtime", "fail_closed_secret_required", "No hosted provider adapter credentials or secret refs are configured."),
        state("neon_store_adapter", "fail_closed_database_required", "No Neon project, branch, migration, role, or connection secret is configured."),
        state("otel_observability_sink", "fail_closed_endpoint_required", "No OTLP endpoint or secret header storage is configured."),
        state("redaction_and_secret_boundary", "supported_local_evidence", "Generated readiness routes contain no secret values and only list secret names/actions."),
      ],
      requiredBeforePublicClaim: [
        "Implement hosted provider adapters behind the provider port with auth, retry, cost, usage, cancellation, redaction, and negative fixtures.",
        "Implement Neon-backed stores behind the store port with migrations, replay, stale-lock, corruption, and credential-failure fixtures.",
        "Implement OTLP sink export with endpoint/header secrets resolved at runtime and redacted evidence.",
        "Run hosted provider, store, and observability smokes against provisioned services.",
      ],
    },
    {
      routeId: "healthz",
      path: "/healthz.json",
      outputPath: "apps/workbench/dist/healthz.json",
      method: "GET",
      contentType: "application/json",
      status: "supported_preview_static_fail_closed",
      claimable: false,
      failClosed: true,
      safeClaim: "A static hosted health route proves the current route bundle can be served and parsed from the registry host.",
      evidence: {
        generatedRouteCount: 4,
        sourceInputHash,
        secretScan: "passed",
      },
      readiness: [
        state("local_route_bundle", "supported_local_evidence", "All generated route files parse as JSON or static headers."),
        state("public_uptime", "supported_public_evidence", "The registry-hosted health route passed public hosted smoke on 2026-06-13."),
      ],
      requiredBeforePublicClaim: [
        "Deploy the static bundle and run an HTTP smoke against the public health route.",
      ],
    },
  ];
}

function routeById(routeId) {
  const route = manifest.routes.find((entry) => entry.routeId === routeId);
  if (!route) throw new Error(`missing route ${routeId}`);
  return {
    schemaVersion: "2026-06-12.hosted-route",
    routeId: route.routeId,
    path: route.path,
    sourceRepo: manifest.sourceRepo,
    sourceCommit: manifest.sourceCommit,
    sourceInputHash: manifest.sourceInputHash,
    generatedAt: manifest.generatedAt,
    freshnessClass: manifest.freshnessClass,
    status: route.status,
    claimable: route.claimable,
    failClosed: route.failClosed,
    safeClaim: route.safeClaim,
    evidence: route.evidence,
    readiness: route.readiness,
    requiredBeforePublicClaim: route.requiredBeforePublicClaim,
    humanInterventions: manifest.humanInterventions,
  };
}

function headersFile() {
  return [
    "/status.json",
    "  Content-Type: application/json; charset=utf-8",
    "  Cache-Control: no-store",
    "  X-Content-Type-Options: nosniff",
    "/release-readiness.json",
    "  Content-Type: application/json; charset=utf-8",
    "  Cache-Control: no-store",
    "  X-Content-Type-Options: nosniff",
    "/provider-store-observability.json",
    "  Content-Type: application/json; charset=utf-8",
    "  Cache-Control: no-store",
    "  X-Content-Type-Options: nosniff",
    "/healthz.json",
    "  Content-Type: application/json; charset=utf-8",
    "  Cache-Control: no-store",
    "  X-Content-Type-Options: nosniff",
    "",
  ].join("\n");
}

function capabilityState(capabilityId) {
  const capability = releaseCapabilities.capabilities?.find((entry) => entry.capabilityId === capabilityId);
  if (!capability) {
    return {
      capabilityId,
      status: "missing",
      claimable: false,
      failClosed: true,
    };
  }
  return {
    capabilityId,
    surface: capability.surface,
    status: capability.status,
    claimable: capability.claimable,
    failClosed: capability.failClosed,
    blockers: capability.blockers ?? [],
    requiredBeforeClaim: capability.requiredBeforeClaim ?? [],
  };
}

function state(surface, status, reason) {
  return { surface, status, reason };
}

function source(id, title, url, observations) {
  return {
    id,
    title,
    url,
    official: true,
    verifiedOn: "2026-06-12",
    observations,
  };
}

function collectSourceRecords() {
  const files = [
    "package.json",
    sourceLockPath,
    "scripts/hosted/generate-hosted-routes.mjs",
    "scripts/hosted/check-hosted-smoke.mjs",
    "scripts/release/generate-capability-manifest.mjs",
    "scripts/release/check-readiness.mjs",
    "apps/workbench/scripts/generate-workbench.mjs",
    "docs/operations/release-readiness.md",
    "docs/generated/release-capability-manifest.json",
    "docs/generated/docs-source-manifest.json",
    "docs/generated/install-readiness-manifest.json",
    "docs/generated/sbom.cdx.json",
  ];
  return files
    .filter((path) => existsSync(join(repoRoot, path)))
    .sort()
    .map((path) => {
      const text = readFileSync(join(repoRoot, path), "utf8");
      return { path, sha256: sha256(text), bytes: Buffer.byteLength(text) };
    });
}

function validateSourceLockDoc() {
  const fullPath = join(repoRoot, sourceLockPath);
  if (!existsSync(fullPath)) fail(`${sourceLockPath} is missing`);
  const text = readFileSync(fullPath, "utf8");
  const missing = officialSources.map((entry) => entry.url).filter((url) => !text.includes(url));
  if (missing.length > 0) fail(`${sourceLockPath} is missing source URLs: ${missing.join(", ")}`);
}

function validateRouteOutputs(outputs) {
  for (const output of outputs) {
    if (output.path.endsWith(".json")) {
      JSON.parse(output.content);
    }
    const matches = output.content.match(secretPattern());
    if (matches) {
      fail(`${output.path} contains unsafe secret-shaped output: ${[...new Set(matches)].join(", ")}`);
    }
  }
  const routeFiles = manifest.routes.map((route) => route.outputPath).sort();
  const outputFiles = outputs.filter((entry) => entry.path.startsWith("apps/workbench/dist/") && entry.path.endsWith(".json")).map((entry) => entry.path).sort();
  if (JSON.stringify(routeFiles) !== JSON.stringify(outputFiles)) {
    fail("route manifest output paths do not match generated JSON route files");
  }
}

function secretPattern() {
  return /\b(sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9_]{12,}|password\s*[:=]\s*[^,\n"]+|credential\s*[:=]\s*[^,\n"]+|api[_-]?key\s*[:=]\s*[^,\n"]+|https:\/\/[^,\n"]+\?(?:[^,\n"]*&)?(?:token|signature|X-Amz-Signature)=)/gi;
}

function readJson(path) {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
}

function out(path, content) {
  return { path, content };
}

function writeOrCheck(outputs, checkMode) {
  const changed = [];
  for (const output of outputs) {
    const fullPath = join(repoRoot, output.path);
    const current = existsSync(fullPath) ? readFileSync(fullPath, "utf8") : undefined;
    if (current !== output.content) changed.push(output.path);
    if (!checkMode) {
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, output.content, "utf8");
    }
  }
  return changed;
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

function runGit(gitArgs) {
  const result = spawnSync("git", gitArgs, { cwd: repoRoot, encoding: "utf8" });
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
    process.stdout.write(`hosted:routes:${payload.status} ${payload.outputPath} routes=${payload.routeCount} sourceInputHash=${payload.sourceInputHash}\n`);
  }
}

function fail(message) {
  process.stderr.write(`hosted:routes:failed ${message}\n`);
  process.exit(2);
}
