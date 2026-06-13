#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = new Set(process.argv.slice(2));
const json = args.has("--json");
const requireHosted = args.has("--require-hosted");
const requireStore = args.has("--require-store");
const requireProvider = args.has("--require-provider");
const requireObservability = args.has("--require-observability");
const baseUrl = normalizeUrl(process.env.JAMI_HARNESS_HOSTED_BASE_URL);
const neonUrl = nonEmpty(process.env.NEON_DATABASE_URL) ?? nonEmpty(process.env.DATABASE_URL);
const otlpEndpoint = nonEmpty(process.env.OTEL_EXPORTER_OTLP_ENDPOINT)
  ?? nonEmpty(process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT);
const providerSecrets = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "AWS_ACCESS_KEY_ID",
].filter((name) => nonEmpty(process.env[name]));

const localRoutes = readLocalRoutes();
const hosted = baseUrl ? await smokeHostedRoutes(baseUrl) : skipped("fail_closed_unconfigured", "JAMI_HARNESS_HOSTED_BASE_URL is not configured.");
const store = inspectStore(neonUrl);
const provider = inspectProvider(providerSecrets);
const observability = inspectObservability(otlpEndpoint);

const checks = [
  localRoutes,
  { surface: "hosted_route_smoke", ...hosted },
  store,
  provider,
  observability,
];

const requiredFailures = [];
if (requireHosted && hosted.status !== "passed") requiredFailures.push("hosted route smoke requires JAMI_HARNESS_HOSTED_BASE_URL and successful HTTP checks");
if (requireStore && store.status !== "passed") requiredFailures.push("hosted store smoke is not executable without a store adapter and live persistence checks");
if (requireProvider && provider.status !== "passed") requiredFailures.push("hosted provider smoke is not executable until a hosted provider adapter exists");
if (requireObservability && observability.status !== "passed") requiredFailures.push("hosted observability smoke is not executable until an OTLP sink adapter exists");

const result = {
  schemaVersion: "2026-06-13.hosted-smoke",
  command: "pnpm hosted:smoke",
  commandResult: requiredFailures.length === 0 ? "passed" : "failed",
  sourceRepo: "jami-harness",
  publicClaim: hosted.status === "passed" ? "hosted_routes_smoked" : "none",
  secretPolicy: {
    secretValuesPrinted: false,
    envNamesOnly: true,
  },
  checks,
  requiredFailures,
};

if (json) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  process.stdout.write(format(result));
}

if (requiredFailures.length > 0) process.exit(2);

function readLocalRoutes() {
  const required = [
    ["status", "apps/workbench/dist/status.json"],
    ["release-readiness", "apps/workbench/dist/release-readiness.json"],
    ["provider-store-observability", "apps/workbench/dist/provider-store-observability.json"],
    ["healthz", "apps/workbench/dist/healthz.json"],
  ];
  const parsed = [];
  const failures = [];
  for (const [routeId, path] of required) {
    const fullPath = join(repoRoot, path);
    if (!existsSync(fullPath)) {
      failures.push(`${path} is missing`);
      continue;
    }
    try {
      const text = readFileSync(fullPath, "utf8");
      assertNoSecretText(path, text);
      const route = JSON.parse(text);
      if (route.routeId !== routeId) failures.push(`${path} has routeId ${route.routeId ?? "missing"} instead of ${routeId}`);
      parsed.push({
        routeId,
        path: route.path,
        status: route.status,
        claimable: route.claimable === true,
        failClosed: route.failClosed === true,
      });
    } catch (error) {
      failures.push(`${path}: ${error.message}`);
    }
  }
  const headersPath = join(repoRoot, "apps/workbench/dist/_headers");
  if (!existsSync(headersPath)) {
    failures.push("apps/workbench/dist/_headers is missing");
  } else {
    assertNoSecretText("apps/workbench/dist/_headers", readFileSync(headersPath, "utf8"));
  }
  return failures.length === 0
    ? { surface: "local_static_route_bundle", status: "passed", routes: parsed }
    : { surface: "local_static_route_bundle", status: "failed", failures };
}

async function smokeHostedRoutes(url) {
  const routePaths = ["/status.json", "/release-readiness.json", "/provider-store-observability.json", "/healthz.json"];
  const responses = [];
  for (const routePath of routePaths) {
    const target = routeUrl(url, routePath);
    const response = await fetchWithTimeout(target);
    if (!response.ok) {
      return {
        status: "failed",
        reason: `${target.toString()} returned HTTP ${response.status}`,
        responses,
      };
    }
    const text = await response.text();
    assertNoSecretText(target.toString(), text);
    const body = JSON.parse(text);
    responses.push({
      path: routePath,
      statusCode: response.status,
      routeId: body.routeId,
      cacheControl: response.headers.get("cache-control"),
      contentType: response.headers.get("content-type"),
    });
  }
  return { status: "passed", baseUrl: redactUrl(url), responses };
}

function routeUrl(baseUrl, routePath) {
  const normalizedBase = baseUrl.pathname.endsWith("/")
    ? baseUrl
    : new URL(`${baseUrl.toString().replace(/\/?$/, "/")}`);
  return new URL(`.${routePath}`, normalizedBase);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function inspectStore(url) {
  if (!url) {
    return skipped("fail_closed_unconfigured", "NEON_DATABASE_URL or DATABASE_URL is not configured.", "hosted_store_smoke");
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { surface: "hosted_store_smoke", status: "failed", reason: "configured database URL is not a valid URL; value was not printed" };
  }
  return {
    surface: "hosted_store_smoke",
    status: "fail_closed_adapter_missing",
    configured: true,
    host: parsed.hostname,
    reason: "A database URL is present, but no Neon-backed store adapter or migration smoke exists in this repo yet.",
  };
}

function inspectProvider(secretNames) {
  return {
    surface: "hosted_provider_smoke",
    status: "fail_closed_adapter_missing",
    configuredSecretNames: secretNames,
    reason: secretNames.length > 0
      ? "Provider secret names are present in the process environment, but no hosted provider adapter smoke exists yet."
      : "No hosted provider secret names are configured, and no hosted provider adapter smoke exists yet.",
  };
}

function inspectObservability(endpoint) {
  if (!endpoint) {
    return skipped("fail_closed_unconfigured", "OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_TRACES_ENDPOINT is not configured.", "hosted_observability_smoke");
  }
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    return { surface: "hosted_observability_smoke", status: "failed", reason: "configured OTLP endpoint is not a valid URL; value was not printed" };
  }
  return {
    surface: "hosted_observability_smoke",
    status: "fail_closed_adapter_missing",
    configured: true,
    endpointOrigin: parsed.origin,
    reason: "An OTLP endpoint is present, but no hosted OTLP sink export smoke exists in this repo yet.",
  };
}

function skipped(status, reason, surface = "hosted_route_smoke") {
  return { surface, status, reason };
}

function normalizeUrl(value) {
  const trimmed = nonEmpty(value);
  if (!trimmed) return undefined;
  const url = new URL(trimmed);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("JAMI_HARNESS_HOSTED_BASE_URL must be http or https");
  return url;
}

function nonEmpty(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function redactUrl(url) {
  const clone = new URL(url.toString());
  clone.username = "";
  clone.password = "";
  clone.search = "";
  return clone.toString();
}

function assertNoSecretText(label, text) {
  const matches = text.match(secretPattern());
  if (matches) {
    throw new Error(`${label} contains secret-shaped output: ${[...new Set(matches)].join(", ")}`);
  }
}

function secretPattern() {
  return /\b(sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9_]{12,}|password\s*[:=]\s*[^,\n"]+|credential\s*[:=]\s*[^,\n"]+|api[_-]?key\s*[:=]\s*[^,\n"]+|https:\/\/[^,\n"]+\?(?:[^,\n"]*&)?(?:token|signature|X-Amz-Signature)=)/gi;
}

function format(payload) {
  const lines = [`${payload.command}: ${payload.commandResult}`];
  for (const check of payload.checks) {
    lines.push(`- ${check.surface}: ${check.status}${check.reason ? ` - ${check.reason}` : ""}`);
  }
  if (payload.requiredFailures.length > 0) {
    lines.push("Required failures:");
    for (const failure of payload.requiredFailures) lines.push(`- ${failure}`);
  }
  return `${lines.join("\n")}\n`;
}
