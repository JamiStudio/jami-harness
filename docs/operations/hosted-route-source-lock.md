# Hosted Route Source Lock

Status: active source-lock evidence
Recorded: 2026-06-12
Owner: Jami Harness

## Purpose

This record locks the current official sources used by the local hosted status/control
route manifest. The manifest is preview-deployable static output for harness status,
release readiness, and provider/store/observability readiness. It does not prove a public
hosted service is live.

The current implementation does not call Cloudflare, Neon, OpenTelemetry collectors,
hosted providers, DNS, or account APIs. It records route requirements and verifies that
generated static route files remain synchronized with this source-lock record and local
release evidence.

## Official Sources Verified

Verified on 2026-06-12:

- Cloudflare Pages Direct Upload:
  `https://developers.cloudflare.com/pages/get-started/direct-upload/`
- Cloudflare Pages custom headers:
  `https://developers.cloudflare.com/pages/configuration/headers/`
- Neon connection strings:
  `https://neon.com/docs/connect/connect-from-any-app`
- OpenTelemetry OTLP exporter configuration:
  `https://opentelemetry.io/docs/languages/sdk-configuration/otlp-exporter/`
- OpenTelemetry environment variable specification:
  `https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/`

## Source Findings

- Cloudflare Pages Direct Upload supports deploying a prebuilt asset folder through
  Wrangler or dashboard upload. This repo only prepares the asset folder; no Cloudflare
  project, upload, domain, or production deployment is recorded.
- Cloudflare Pages applies custom static response headers from an `_headers` file in the
  static asset directory. The generated route bundle uses `_headers` for JSON content
  type, `no-store`, and `nosniff` headers, but this remains unproven until served by the
  hosted target.
- Neon application connections require details from a Neon project and branch. A Neon
  connection string includes role, password, hostname, and database name, so hosted-store
  route output must list required secret names/actions without committing connection
  values.
- OpenTelemetry OTLP exporter configuration uses endpoint variables for traces, metrics,
  logs, and profiles, and may use header variables for API-key style metadata. Generated
  readiness output must not include OTLP header values or provider tokens.
- OpenTelemetry environment variable handling treats empty values like unset values. The
  readiness route therefore records missing or empty hosted endpoint variables as
  fail-closed until runtime configuration is present and smoke-tested.

## Implemented In This Pass

- `pnpm hosted:routes` writes `docs/generated/hosted-route-manifest.json`,
  `apps/workbench/generated/hosted-route-manifest.json`, and static preview route files
  under `apps/workbench/dist/`.
- `pnpm hosted:routes:check` fails when generated route files drift from this source-lock
  record, generated docs evidence, release capability evidence, install readiness
  evidence, SBOM evidence, or the hosted route generator.
- The generated route bundle includes:
  - `/status.json`
  - `/release-readiness.json`
  - `/provider-store-observability.json`
  - `/healthz.json`
  - `_headers`
- The route check validates JSON output and scans generated route files for common
  secret-shaped markers.

## Unsupported Or Not Claimed

- No Cloudflare Pages project was created.
- No DNS target was configured.
- No public hosted URL was smoke-tested.
- No Neon project, branch, role, migration, or connection secret was provisioned.
- No hosted provider credentials or provider account routes were used.
- No OTLP endpoint, collector, or hosted observability sink was configured.
- No hosted workbench/control plane is claimed. The route bundle is static preview output
  only.

## Refresh Triggers

- Any Cloudflare Pages, Workers, Vercel, Mintlify, or other hosted target implementation.
- Any DNS, cache, redirect, header, or integrity policy change for hosted routes.
- Any Neon-backed store adapter or migration implementation.
- Any hosted provider adapter implementation or provider secret naming change.
- Any OpenTelemetry exporter, collector, sink, endpoint, or header configuration change.
- Any hosted smoke, public URL, account authorization, or deployment evidence.
