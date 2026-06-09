# Release Readiness

Status: Active release gate
Last updated: 2026-06-09

## Purpose

This document is the release, supply-chain, hosted-readiness, and public-claims gate for
Jami Harness. It records what can be claimed from current evidence and what must stay
blocked until the repo has real command evidence or a human account intervention.

No command in this repo publishes to npm, creates a GitHub release, deploys public docs,
or calls a hosted provider. Those actions remain blocked until the intervention ledger
below is closed.

## Current Release Posture

- Root verification exists as `pnpm verify` and includes docs, contract generation drift,
  contract validation, package tests, CLI tests, SDK tests, the local evidence smoke, and
  both non-publishing release audit commands.
- Release audit commands exist as `pnpm release:readiness` and `pnpm release:dry-run`.
  They do not publish. They report package, SBOM, provenance, attestation, claims, and
  account-action state.
- All package manifests remain `private: true`. That is intentional until package scope,
  publish metadata, npm provenance, and account permissions are accepted.
- `docs/` remains the canonical public-doc source. Mintlify or other public docs hosting
  is not configured.
- Changelog fragments in `.changes/` remain the accepted input for future release notes.
  Release-note compilation is not implemented yet.

## Verification Commands

Run these commands before making any release-readiness claim:

```powershell
pnpm docs:check
pnpm contracts:generate:check
pnpm contracts:validate
pnpm policy:test
pnpm runtime:test
pnpm artifacts:test
pnpm observability:test
pnpm memory:test
pnpm sdk:test
pnpm cli:test
pnpm examples:smoke
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
| `pnpm docs:generate -- --check` | Docs generator package and docs-source manifests are not implemented. | Add docs-source manifests, generator metadata, source commit, freshness class, and drift check. |
| `pnpm sbom:generate` | SBOM policy is defined here, but no generated SBOM artifact command exists. | Add a local SBOM generator or accepted external tool with source-lock evidence and a check mode. |
| `npm publish --dry-run --provenance` | Packages remain private and npm automation scope is not recorded. | Confirm npm account/org access, package scope, `publishConfig`, provenance, and package contents. |
| GitHub release attestation | Artifact attestation workflow is not implemented. | Add a release workflow or local attestation procedure and verify it against a dry-run artifact. |
| Mintlify build/publish | Mintlify shell and navigation config are not implemented. | Add docs config and local build verification before public docs hosting claims. |
| Vercel or Cloudflare deploy dry run | Hosted target is not selected or authorized. | Record account/project target and dry-run/deploy evidence. |

## Public Claims Matrix

| Public claim | Status | Evidence | Safe wording |
| --- | --- | --- | --- |
| Harness contracts, compatibility fixtures, generated references, and validation exist. | Supported | `packages/contracts/schemas/`, `packages/contracts/fixtures/`, `packages/contracts/generated/`, `pnpm contracts:generate:check`, `pnpm contracts:validate`. | "The repo includes an initial generated contract and fixture spine." |
| Local SDK composes runtime, policy, artifacts, observability, and memory defaults. | Supported | `packages/sdk/src/index.mjs`, `packages/sdk/test/sdk.test.mjs`, `packages/sdk/README.md`, `pnpm sdk:test`. | "The SDK supports local evidence runs and module inspection for current foundations." |
| CLI supports local init, evidence run, inspect, module map, and verify commands. | Supported | `apps/cli/src/cli.mjs`, `apps/cli/test/cli.test.mjs`, `apps/cli/README.md`, `pnpm cli:test`, `pnpm examples:smoke`. | "The CLI can run and inspect the local evidence smoke." |
| Policy, runtime, memory, artifacts, and observability fail closed on current negative fixtures. | Supported for current fixtures | Package tests and contract fixtures listed in `packages/contracts/README.md`. | "Current foundation fixtures cover fail-closed policy/runtime/evidence cases." |
| Provider runtime, tool gateway, hosted workbench, hosted stores, docs generation, release publishing, or public docs hosting exist. | Unsupported | CLI and SDK README files state these are unavailable; roadmap Workstreams 4, 6, 8, and 9 remain open. | "Those surfaces are planned and currently unavailable." |
| Release artifacts are signed, attested, SBOM-backed, or publish-ready. | Unsupported | This release gate, `private: true` package manifests, and unavailable command ledger. | "The repo has release-readiness policy and audit commands; publishable artifacts are not ready." |

## SBOM Policy

Before any package or release artifact is called publish-ready:

- Generate an SBOM from the exact package set being released.
- Record generator name, generator version, command, timestamp, source commit, package
  names, package versions, license metadata, and output path.
- Verify the SBOM with a check command that fails when package inventory or license
  metadata drifts.
- Keep generated SBOM artifacts free of secrets and signed URLs.
- Treat imported research archives as source context unless a release package actually
  includes their files. If files are promoted, include their upstream license and notice
  material.

## Source And License Provenance

- The repository license is Apache-2.0.
- Package manifests carry Apache-2.0 metadata and repository pointers.
- `NOTICE` records the current third-party source posture.
- No third-party runtime source is currently promoted from `docs/research` into
  publishable packages. If future work lifts, forks, or adapts third-party source, the
  release gate must add upstream license, notice, package version, tarball/commit, hash,
  and fork-delta evidence before any publish claim.

## Package Provenance And Attestation Policy

Before removing `private: true` from any publishable manifest:

- Add package `files` or an equivalent contents policy so docs archives, `.env` files,
  local state, logs, and research-only archives cannot enter npm packages accidentally.
- Add `publishConfig` only after package scope and registry are accepted.
- Run a package contents dry run and record the included file list.
- Use npm provenance/OIDC where npm publishing is used.
- Produce or verify GitHub artifact attestations for release archives before claiming
  signed or attested artifacts.
- Record the Git commit, tag, package versions, changelog fragments consumed, and
  verification commands in the release packet.

## Human Interventions

These are real account or product actions. They must be recorded as interventions, not
stubbed around:

- Confirm npm organization access for `@jami-studio` and provenance/OIDC setup.
- Confirm GitHub release, tag, Actions, and artifact attestation permissions.
- Select and authorize a public docs target before Mintlify, Vercel, or Cloudflare claims.
- Approve package publication scope, package names, contents policy, and versioning.
- Refresh repo-local source-lock evidence for release tools and hosted services used by
  the release.
