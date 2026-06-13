# Release Readiness

Status: Active release gate
Last updated: 2026-06-12

## Purpose

This document is the release, supply-chain, hosted-readiness, and public-claims gate for
Jami Harness. It records what can be claimed from current evidence and what must stay
blocked until the repo has real command evidence or a human account intervention.

No command in this repo deploys public docs, calls a hosted provider, writes a hosted
store, or exports to a hosted OTLP sink. The public npm/GitHub release lane has been
executed for `0.1.0`; the current provider path remains a first-party local
deterministic adapter only. Hosted-provider actions remain blocked until the intervention
ledger below is closed.

## Current Release Posture

- Root verification exists as `pnpm verify` and includes docs, contract generation drift,
  docs generation drift, contract validation, package tests, CLI tests, SDK tests, the
  local evidence smoke, and both non-publishing release audit commands.
- Release audit commands exist as `pnpm release:readiness` and `pnpm release:dry-run`.
  They do not publish. They report package, SBOM, provenance, attestation, claims, and
  account-action state.
- SBOM dry-run commands exist as `pnpm sbom:generate` and `pnpm sbom:check`. They emit
  and verify a local CycloneDX `1.7` workspace package-manifest inventory at
  `docs/generated/sbom.cdx.json`; this is not a publish tarball SBOM, attestation, or
  provenance claim.
- Release/hosted capability manifest commands exist as `pnpm release:capabilities` and
  `pnpm release:capabilities:check`. They emit and verify
  `docs/generated/release-capability-manifest.json` from package metadata, release docs,
  local SBOM/docs evidence, release scripts, and official-source links in
  `docs/operations/release-capability-source-lock.md`.
- Hosted status/control route commands exist as `pnpm hosted:routes`,
  `pnpm hosted:routes:check`, and `pnpm hosted:smoke`. They emit, verify, and smoke
  `docs/generated/hosted-route-manifest.json`, a workbench mirror, and static route files
  under `apps/workbench/dist/` for `/status.json`, `/release-readiness.json`,
  `/provider-store-observability.json`, `/healthz.json`, and `_headers`. The selected
  public target is `https://registry.jami.studio/harness/` on the existing registry
  Cloudflare Pages project. Hosted smoke against that URL passed for the current bundle on
  2026-06-13.
- Publishable package manifests are public-package ready and the public npm release has
  executed for `@jami-studio/*@0.1.0` through the trusted GitHub Actions lane. The current
  source prepares a `0.1.1` patch for `@jami-studio/harness-core`,
  `@jami-studio/harness-sdk`, and `@jami-studio/harness-cli` so public SDK/CLI inspection
  no longer reports stale release blockers. The root, docs, and workbench packages remain
  intentionally private because they are not published package surfaces.
- `packages/docs` now generates local docs artifacts from accepted source records into
  `docs/generated/` and a Mintlify-ready draft under `apps/docs/`.
- `docs/generated/docs-source-manifest.json` records source records, accepted contracts
  and evidence references, command result, freshness class, and generated output paths.
- `docs/generated/install-readiness-manifest.json` records the full local
  source-checkout install path and modular BYO memory, context, search, store, provider,
  policy, tools, artifact, observability, and docs-output paths.
- CLI/SDK source inspection now reports tool adapter manifests and source-lock states for
  supported function/trusted MCP fixture paths plus fail-closed OpenAPI, shell, browser,
  code, provider-as-tool, and A2A dry-run evidence.
- `packages/observability` now records local latency, token-estimate,
  external-billable-cost, and tool-call metric records with redacted dimensions, and
  `pnpm eval:smoke` runs deterministic local scenarios for tool safety, docs generation,
  memory recall, and recovery without a hosted observability or external eval backend.
- `docs/` remains the canonical public-doc source. Mintlify build/publish and public
  docs hosting are not configured.
- Changelog fragments in `.changes/` are consumed by the generated changelog draft.

## Verification Commands

Run these commands before making any release-readiness claim:

```powershell
pnpm docs:check
pnpm docs:generate -- --check
pnpm contracts:generate:check
pnpm contracts:validate
pnpm sbom:generate
pnpm sbom:check
pnpm release:capabilities
pnpm release:capabilities:check
pnpm hosted:routes
pnpm hosted:routes:check
pnpm hosted:smoke
pnpm hosted:smoke:test
pnpm policy:test
pnpm runtime:test
pnpm tools:test
pnpm provider:test
pnpm artifacts:test
pnpm observability:test
pnpm memory:test
pnpm sdk:test
pnpm cli:test
pnpm examples:smoke
pnpm eval:smoke
pnpm release:readiness
pnpm release:dry-run
pnpm verify
git diff --check
git ls-files | Select-String -Pattern '(^|/)\.env(\.|$)|token|secret|credential|password|api[_-]?key' -CaseSensitive:$false
```

The tracked-file review is a secret scan of tracked paths and names. It does not inspect
ignored `.env` files and must not print secret values.

The release audit JSON uses the current Git `HEAD` commit date for `generatedAt` so
local readiness and dry-run output stays deterministic for a given source state.

## Unavailable Commands

These commands or command families are not available yet. Do not stub them or claim their
results.

| Surface | Current state | Required before claim |
| --- | --- | --- |
| npm publish/provenance patch release | The `0.1.0` public release is complete; this source tree prepares `0.1.1` for changed core/SDK/CLI package behavior. | Run package dry-run/smoke, publish `@jami-studio/harness-core@0.1.1`, `@jami-studio/harness-sdk@0.1.1`, and `@jami-studio/harness-cli@0.1.1` with provenance, then rerun clean public install/import smoke. |
| GitHub release attestation | The `v0.1.0` harness release bundle attestation verifies; any new release artifact requires a new attestation verification. | Create the release artifact through the accepted workflow and verify it with `gh attestation verify`. |
| Mintlify validation/build/publish | Mintlify-ready `docs.json` and MDX drafts are generated locally, but the Mintlify CLI/package is not installed or source-locked in this repo. Current official CLI docs list `mint validate` as the strict local documentation build validation command. | Add source-lock evidence for the exact Mintlify CLI/package, install it intentionally, and run `mint validate` or the accepted current local build check before public docs hosting claims. |
| Vercel or Cloudflare deploy dry run | The harness status/control target is selected as the existing registry Cloudflare Pages project under `/harness/`; separate hosted docs/runtime targets remain unselected. | Publish the accepted static bundle and record deploy evidence for changed static routes. |
| Neon hosted store smoke | No Neon project, branch, role, migration, or connection secret is configured. | Provision Neon, store connection material in the accepted secret system, run migrations, and smoke persisted run/checkpoint/artifact/trace state. |
| OTLP hosted observability export smoke | No OTLP endpoint, collector, or secret header storage is configured. | Provision the OTLP endpoint and secret header resolver, then smoke trace and metric export with redacted evidence. |

## Public Claims Matrix

| Public claim | Status | Evidence | Safe wording |
| --- | --- | --- | --- |
| Harness contracts, compatibility fixtures, generated references, and validation exist. | Supported | `packages/contracts/schemas/`, `packages/contracts/fixtures/`, `packages/contracts/generated/`, `pnpm contracts:generate:check`, `pnpm contracts:validate`. | "The repo includes an initial generated contract and fixture spine." |
| Local SDK composes runtime, policy, artifacts, observability, and memory defaults. | Supported | `packages/sdk/src/index.mjs`, `packages/sdk/test/sdk.test.mjs`, `packages/sdk/README.md`, `pnpm sdk:test`. | "The SDK supports local evidence runs and module inspection for current foundations." |
| CLI supports local init, evidence run, inspect, module map, and verify commands. | Supported | `apps/cli/src/cli.mjs`, `apps/cli/test/cli.test.mjs`, `apps/cli/README.md`, `pnpm cli:test`, `pnpm examples:smoke`. | "The CLI can run and inspect the local evidence smoke." |
| Tool gateway foundation supports registry inspection, policy-gated function execution, trusted MCP fixture execution, typed trace/audit/evidence/artifact output, redaction, adapter manifests, and unsupported adapter dry-run evidence. | Supported for current fixtures | `packages/tools/src/index.mjs`, `packages/tools/test/tools.test.mjs`, `packages/contracts/schemas/tool-execution.schema.json`, `pnpm tools:test`, `pnpm contracts:validate`. | "The repo includes a narrow policy-gated tool gateway foundation for function tools and trusted MCP fixtures; executable protocol/local adapters remain unsupported unless specifically listed." |
| CLI/SDK source inspection reports tool adapter manifests and source-lock state. | Supported for current fixtures | `packages/sdk/src/index.mjs`, `apps/cli/src/cli.mjs`, `packages/tools/test/tools.test.mjs`, `apps/cli/test/cli.test.mjs`, `pnpm tools:test`, `pnpm sdk:test`, `pnpm cli:test`. | "The CLI and SDK expose local adapter readiness and missing source-lock states without executing unsupported adapters." |
| Local deterministic provider workflow executes through the SDK, tool gateway, policy, traces, artifacts, checkpoints, memory/context, and evidence. | Supported for current fixtures | `packages/provider-local/src/index.mjs`, `packages/provider-local/test/provider-local.test.mjs`, `packages/sdk/test/sdk.test.mjs`, `apps/cli/test/cli.test.mjs`, `pnpm provider:test`, `pnpm sdk:test`, `pnpm cli:test`. | "The repo includes a local deterministic provider foundation for workflow and recovery fixtures; hosted providers remain unsupported." |
| Local latency, token-estimate, external-billable-cost, and tool-call metrics plus deterministic regression eval smokes exist. | Supported for current local fixtures | `packages/observability/src/index.mjs`, `packages/observability/test/observability.test.mjs`, `evals/smoke.mjs`, `pnpm observability:test`, `pnpm eval:smoke`. | "The repo records local redacted usage metrics for current fixtures, including estimated tokens and zero external billable provider cost for the local deterministic provider; hosted observability, external eval backends, hosted-provider billing, and total compute cost are not claimed." |
| Policy, runtime, memory, artifacts, and observability fail closed on current negative fixtures. | Supported for current fixtures | Package tests and contract fixtures listed in `packages/contracts/README.md`. | "Current foundation fixtures cover fail-closed policy/runtime/evidence cases." |
| Local docs generation can produce quickstart, user manual, API/reference summary, system map, changelog draft, evidence index, docs-source manifest, and Mintlify-ready navigation draft. | Supported for current source records | `packages/docs/scripts/generate-docs.mjs`, `docs/generated/docs-source-manifest.json`, `apps/docs/docs.json`, `pnpm docs:generate -- --check`. | "The repo includes local generated docs artifacts and a Mintlify-ready draft; hosted docs are not published." |
| Full local source-checkout, clean tarball, and public npm install paths are inspectable and generated into release docs. | Supported for current foundations | `packages/sdk/src/index.mjs`, `apps/cli/src/cli.mjs`, `docs/generated/install-readiness-manifest.json`, `docs/generated/package-install-smoke.json`, `packages/sdk/test/sdk.test.mjs`, `apps/cli/test/cli.test.mjs`, `pnpm sdk:test`, `pnpm cli:test`, `pnpm docs:generate -- --check`, clean public npm install smoke evidence. | "The repo documents and exposes the current local source-checkout path, clean tarball smoke, and public npm install path; hosted runtime routes remain unavailable." |
| Local SBOM dry-run generation can produce and drift-check a CycloneDX workspace package-manifest inventory. | Supported for current source records | `scripts/release/generate-sbom.mjs`, `docs/operations/sbom-source-lock.md`, `docs/generated/sbom.cdx.json`, `pnpm sbom:generate`, `pnpm sbom:check`. | "The repo includes a local SBOM dry-run artifact for workspace package manifests; release artifacts are not signed, attested, or publish-ready." |
| Release and hosted capability readiness can be generated and drift-checked from current package metadata, official-source links, and local evidence. | Supported for current local evidence | `scripts/release/generate-capability-manifest.mjs`, `docs/operations/release-capability-source-lock.md`, `docs/generated/release-capability-manifest.json`, `pnpm release:capabilities`, `pnpm release:capabilities:check`. | "The repo includes a generated release capability manifest; unsupported publish, provenance, attestation, Mintlify, hosted docs, hosted provider, hosted store, and hosted workbench surfaces fail closed." |
| Hosted status/control routes can be generated, drift-checked, served, and smoked as static JSON for the selected registry host path. | Supported for current public evidence | `scripts/hosted/generate-hosted-routes.mjs`, `docs/operations/hosted-route-source-lock.md`, `docs/generated/hosted-route-manifest.json`, `apps/workbench/dist/status.json`, `apps/workbench/dist/release-readiness.json`, `apps/workbench/dist/provider-store-observability.json`, `apps/workbench/dist/healthz.json`, `apps/workbench/dist/_headers`, `pnpm hosted:routes`, `pnpm hosted:routes:check`, `JAMI_HARNESS_HOSTED_BASE_URL=https://registry.jami.studio/harness/ pnpm hosted:smoke -- --require-hosted`. | "The repo generates and serves static status/control routes at `https://registry.jami.studio/harness/`; provider, store, and observability readiness still fail closed." |
| Hosted provider runtime, executable full MCP/OpenAPI/shell/browser/code/provider-as-tool/A2A adapters, hosted workbench, hosted stores, Mintlify build/publish, or public docs hosting exist. | Unsupported | CLI, SDK, tools, and provider README files state unavailable hosted/protocol surfaces; this release gate records hosted docs and runtime blockers; roadmap Workstreams 4, 6, 8, and 9 remain open. | "Those surfaces are planned and currently unavailable." |
| Release artifacts are signed, attested, externally published, or publish-ready. | Supported for `v0.1.0`; patch releases require fresh evidence | GitHub Release `v0.1.0`, package publish workflow, release artifact workflow, package install smoke, and attestation verification evidence. | "The `0.1.0` public package and release artifact lane is complete; future changed package behavior needs a new patch release." |

## SBOM Policy

Before any package or release artifact is called publish-ready:

- Generate an SBOM from the exact package set being released.
- Record generator name, generator version, command, source commit or checked symbolic
  source marker, package names, package versions, license metadata, and output path.
- Verify the SBOM with a check command that fails when package inventory or license
  metadata drifts.
- Keep generated SBOM artifacts free of secrets and signed URLs.
- Treat imported research archives as source context unless a release package actually
  includes their files. If files are promoted, include their upstream license and notice
  material.

Current local implementation:

- `pnpm sbom:generate` writes a CycloneDX `1.7` workspace package-manifest inventory to
  `docs/generated/sbom.cdx.json`.
- `pnpm sbom:check` verifies that the checked artifact still matches package manifests,
  package metadata, workspace dependency edges, and the symbolic `git:HEAD` provenance
  marker used to keep tracked generated files deterministic after commit. Runtime command
  output resolves the current commit for audit use.
- The source-lock evidence for this local format/tooling choice is
  `docs/operations/sbom-source-lock.md`.
- The local SBOM dry-run artifact remains non-publishing evidence until package contents
  dry-runs, provenance, and attestation gates are implemented.

## Hosted And Release Capability Manifest

Current local implementation:

- `pnpm release:capabilities` writes
  `docs/generated/release-capability-manifest.json`.
- `pnpm release:capabilities:check` fails when the checked manifest drifts from package
  metadata, release-readiness docs, SBOM evidence, generated docs config, release scripts,
  or official-source links recorded in
  `docs/operations/release-capability-source-lock.md`.
- `pnpm verify` runs the release capability manifest drift check before generated docs and
  release readiness audits.
- `pnpm release:readiness` and `pnpm release:dry-run` verify that the generated manifest
  marks package contents dry-runs, clean local tarball install smoke, public npm
  provenance, GitHub release attestations, and the static preview route bundle as
  supported evidence while keeping Mintlify validation/publishing, hosted public docs,
  hosted provider runtime, hosted durable stores, hosted observability sinks, and hosted
  workbench surfaces fail-closed unsupported.

Current unsupported surfaces:

- New npm publish/provenance/trusted-publishing patch release after package behavior changes.
- New GitHub release artifact attestations after package behavior changes.
- Mintlify CLI validation or hosted docs publishing.
- Hosted public docs on Mintlify, Vercel, Cloudflare, or any other target.
- Hosted provider runtime.
- Hosted durable stores.
- Hosted observability sinks.
- Hosted workbench.

This manifest is evidence that unsupported surfaces stay blocked. It is not evidence that
those surfaces work.

## Hosted Status And Control Routes

Current local implementation:

- `pnpm hosted:routes` writes `docs/generated/hosted-route-manifest.json`,
  `apps/workbench/generated/hosted-route-manifest.json`, and preview static route files
  under `apps/workbench/dist/`.
- `pnpm hosted:routes:check` fails when generated route files drift from source-lock
  evidence, release capability evidence, generated docs evidence, install readiness
  evidence, SBOM evidence, or route-generator source.
- The generated route bundle is designed for static hosting at
  `https://registry.jami.studio/harness/` and includes `/status.json`,
  `/release-readiness.json`, `/provider-store-observability.json`, `/healthz.json`, and
  `_headers`.
- Generated route files contain no secret values. They list missing human actions and
  expected secret names only.

Current unsupported surfaces:

- Separate Cloudflare Pages project creation or DNS route configuration for harness
  status/control.
- Hosted status/control route smoke must be rerun after registry route bundle changes.
- Neon-backed hosted store runtime.
- Hosted provider runtime.
- OTLP hosted observability export.
- Hosted workbench/control plane.

The route bundle is a hosted-route acceptance record for the current static status,
release-readiness, provider/store/observability readiness, and health routes because
`pnpm hosted:smoke -- --require-hosted` passed against
`https://registry.jami.studio/harness/` on 2026-06-13. It keeps hosted provider, store,
and observability runtime claims fail-closed until those account/env actions are
completed.

## Install And Module Replacement Readiness

The current supported install path is a local source checkout:

```powershell
pnpm install --frozen-lockfile
node apps/cli/src/cli.mjs init --json
node apps/cli/src/cli.mjs run --json
node apps/cli/src/cli.mjs inspect --json
```

The public npm install path is supported for the published `@jami-studio/*@0.1.0`
harness packages. The corrected public SDK/CLI inspection path is prepared as a `0.1.1`
patch for `@jami-studio/harness-core`, `@jami-studio/harness-sdk`, and
`@jami-studio/harness-cli`. Source-checkout and clean tarball smokes remain useful local
gates; package behavior changes require the patch version and public install smoke before
external acceptance can cite them.

Current module replacement evidence is exposed by `harness.inspect().installPaths`,
`jami map --json`, `jami docs --json`, and
`docs/generated/install-readiness-manifest.json`:

| Path | Status | Current boundary |
| --- | --- | --- |
| BYO memory/context/search | Supported port foundation | Local/no-op and memory-backed paths exist; hosted/vector retrieval remains unavailable. |
| BYO checkpoint store | Supported port foundation | In-memory and filesystem local stores exist; hosted stores remain unavailable. |
| BYO provider | Supported local provider port | Local deterministic provider exists; hosted providers fail closed. |
| BYO policy engine | Supported port foundation | Replacement stays behind the default-deny policy seam and audit evidence requirements. |
| BYO tools | Supported current adapters only | Function tools and trusted MCP fixtures exist; broader protocol/local adapters remain fail-closed unsupported. |
| BYO artifacts and observability | Supported port foundations | Local stores/sinks exist; hosted artifact and observability backends remain unavailable. |
| BYO docs output | Repo generator supported; SDK output unavailable | `pnpm docs:generate` works locally; SDK docs-output injection and hosted docs publishing remain unavailable. |

## Source And License Provenance

- The repository license is Apache-2.0.
- Package manifests carry Apache-2.0 metadata and repository pointers.
- `NOTICE` records the current third-party source posture.
- No third-party runtime source is currently promoted from `docs/research` into
  publishable packages. If future work lifts, forks, or adapts third-party source, the
  release gate must add upstream license, notice, package version, tarball/commit, hash,
  and fork-delta evidence before any publish claim.

## Package Provenance And Attestation Policy

Before publishing a changed package version:

- Add package `files` or an equivalent contents policy so docs archives, `.env` files,
  local state, logs, and research-only archives cannot enter npm packages accidentally.
- Add `publishConfig` only after package scope and registry are accepted.
- Run a package contents dry run and record the included file list.
- Use npm provenance/OIDC where npm publishing is used.
- Produce or verify GitHub artifact attestations for release archives before claiming
  signed or attested artifacts.
- Keep `docs/generated/release-capability-manifest.json` in sync and fail-closed until
  the specific publish, provenance, attestation, docs hosting, provider, store, or
  workbench capability has executable local evidence.
- Record the Git commit, tag, package versions, changelog fragments consumed, and
  verification commands in the release packet.

## Human Interventions

These are real account or product actions. They must be recorded as interventions, not
stubbed around:

- Confirm npm organization access for `@jami-studio` and provenance/OIDC setup for any
  new patch release.
- Confirm GitHub release, tag, Actions, and artifact attestation permissions for any new
  release artifact.
- Select and authorize a public docs target before Mintlify, Vercel, or Cloudflare claims.
- Rerun hosted status/control smoke after any registry route bundle change before
  refreshing live route claims.
- Provision Neon project, branch, role, migration path, and secret storage before hosted
  store claims.
- Provision hosted provider credentials and OTLP endpoint/header secret storage before
  hosted provider or hosted observability claims.
- Approve package publication scope, package names, contents policy, and versioning.
- Refresh repo-local source-lock evidence for release tools and hosted services used by
  the release.
