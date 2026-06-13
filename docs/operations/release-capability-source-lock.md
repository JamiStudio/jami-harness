# Release Capability Source Lock

Status: active source-lock evidence
Recorded: 2026-06-09
Owner: Jami Harness

## Purpose

This record locks the current official sources used by the local release capability
manifest. The manifest is executable local evidence for what Jami Harness can claim now
and what must remain fail-closed until package publishing, attestations, Mintlify
validation, hosted docs, hosted providers, hosted stores, or a hosted workbench are
implemented.

The current implementation does not call npm, GitHub, Mintlify, Vercel, Cloudflare, or
hosted providers. It records source requirements and verifies that the generated manifest
stays in sync with this source-lock record.

## Official Sources Verified

Verified on 2026-06-09:

- npm provenance statements: `https://docs.npmjs.com/generating-provenance-statements/`
- npm trusted publishing: `https://docs.npmjs.com/trusted-publishers/`
- npm publish command: `https://docs.npmjs.com/cli/v10/commands/npm-publish/`
- GitHub artifact attestations overview:
  `https://docs.github.com/en/actions/concepts/security/artifact-attestations`
- GitHub artifact attestation workflow:
  `https://docs.github.com/en/enterprise-cloud@latest/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations`
- Mintlify CLI commands: `https://www.mintlify.com/docs/cli/commands`
- Mintlify `docs.json` settings:
  `https://www.mintlify.com/docs/organize/settings-reference`

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

- npm provenance requires a supported CI/CD environment, compatible npm CLI, repository
  metadata that matches the publishing source, and an actual publish flow. Trusted
  publishing can generate provenance automatically for public packages from public
  repositories when OIDC and package settings are configured.
- npm trusted publishing currently requires explicit publisher configuration, including
  workflow filename for GitHub Actions, and uses OIDC from supported cloud CI/CD providers.
  This repo has no recorded trusted publisher configuration.
- npm publish dry-run and provenance flags exist, but package contents, `files` policy,
  `publishConfig`, versioning, access, and account authorization must be accepted before
  any npm publish dry run is meaningful.
- GitHub artifact attestations are release-artifact evidence, not a substitute for local
  checks. GitHub documents workflow permissions such as `id-token: write` and
  `attestations: write`, `actions/attest`, and `gh attestation verify` for verification.
  This repo has no release artifact or attestation workflow.
- Mintlify's current CLI docs list `mint validate` as the strict local documentation build
  validation command. The repo currently generates `apps/docs/docs.json`, but the Mintlify
  CLI/package is not installed or source-locked, and no hosted Mintlify project is
  selected.
- Mintlify `docs.json` is the current configuration file shape for generated docs, and
  current required root fields include `theme`, `name`, `colors`, and `navigation`. The
  local generated `apps/docs/docs.json` is only a draft until `mint validate` or an
  accepted hosted-docs build runs.
- Cloudflare Pages can accept a prebuilt static asset folder by direct upload, and
  Cloudflare Pages custom headers are configured with an `_headers` file in the static
  asset directory. The harness now generates static status/control JSON route files and
  `_headers`, but no Cloudflare project, DNS target, deploy, or hosted smoke exists.
- Neon connection details come from a Neon project and branch, and the connection string
  includes role, password, hostname, and database name. Hosted store readiness must list
  secret names and human actions without writing connection values to tracked output.
- OpenTelemetry OTLP exporter configuration uses endpoint variables for traces, metrics,
  logs, and profiles, and header variables may carry API keys. Hosted observability
  readiness remains fail-closed until endpoint and header secrets are resolved at runtime
  and smoke-tested without leaking values.

## Implemented In This Pass

- `pnpm release:capabilities` writes
  `docs/generated/release-capability-manifest.json`.
- `pnpm hosted:routes` writes `docs/generated/hosted-route-manifest.json`,
  `apps/workbench/generated/hosted-route-manifest.json`, and preview static route files
  under `apps/workbench/dist/`.
- `pnpm hosted:routes:check` verifies the preview route bundle and fails on generated
  drift or common secret-shaped output.
- `pnpm release:capabilities:check` fails when the generated manifest drifts from package
  metadata, this source-lock record, hosted route source-lock evidence, release docs,
  SBOM evidence, docs config, hosted route scripts, or release scripts.
- `pnpm verify` runs the release capability manifest drift check before generated docs and
  release readiness audits.
- `pnpm release:readiness` and `pnpm release:dry-run` check that the generated manifest
  exists, marks package contents dry-runs and clean local tarball install smoke as
  supported local evidence, and still marks npm publishing/provenance, GitHub
  attestations, Mintlify validation/publishing, hosted public docs, hosted provider
  runtime, hosted durable stores, and hosted workbench as fail-closed unsupported.

## Unsupported Or Not Claimed

- No npm publish dry run, trusted publishing, staged publish, or provenance publish was
  attempted.
- Package contents dry-runs and clean local tarball install smoke are generated locally;
  no npm publish dry run, trusted publishing, staged publish, or provenance publish was
  attempted.
- No GitHub release artifact or attestation was generated or verified.
- No Mintlify CLI validation, hosted build, or hosted publish was run.
- No Vercel, Cloudflare, or other hosted docs target was selected or called.
- No hosted provider, hosted durable store, or hosted workbench was implemented.
- No Cloudflare Pages harness status/control project, DNS route, deploy, or hosted smoke
  was run.
- No Neon project, branch, migration, role, or connection secret was provisioned.
- No OpenTelemetry collector, OTLP endpoint, header secret storage, or hosted export
  smoke was configured.

## Refresh Triggers

- Any release package changes from `private: true` to publishable.
- Any addition of npm trusted publishing, npm stage publish, provenance publish, package
  versioning changes, or release workflows.
- Any GitHub artifact attestation or signed release archive implementation.
- Any Mintlify CLI install, source-lock, `mint validate`, hosted Mintlify project, or
  hosted docs target.
- Any hosted provider, hosted store, workbench, Vercel, Cloudflare, or other hosted
  capability implementation.
- Any official-source change that alters required commands, OIDC constraints, attestation
  verification, or Mintlify validation behavior.
