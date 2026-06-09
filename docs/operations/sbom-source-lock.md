# SBOM Source Lock

Status: active source-lock evidence
Recorded: 2026-06-09
Owner: Jami Harness

## Locked Source

- Format: CycloneDX JSON
- Spec version: `1.7`
- Freshness: official CycloneDX specification overview and TC54 pages identify `1.7`
  as the current version on 2026-06-09.
- License/provenance: no third-party SBOM generator source or package is copied into
  this repo. The local generator is dependency-free and emits a package-manifest SBOM
  dry-run artifact for the current workspace.

Official source pages verified for this pass:

- `https://cyclonedx.org/specification/overview`
- `https://cyclonedx.org/docs/latest`
- `https://tc54.org/cyclonedx/`
- `https://docs.npmjs.com/cli/commands/npm-sbom/`

## Evidence Summary

- CycloneDX is the selected local SBOM format for the dry-run artifact because it supports
  JSON output and package inventory metadata.
- The current official CycloneDX version is `1.7`; `docs/latest` points at the latest
  JSON reference.
- npm documents `npm sbom` as an SBOM command that can emit CycloneDX or SPDX, but this
  repo does not use it yet because the workspace is pnpm-based and release tooling is
  intentionally dependency-free in this pass.
- The checked local artifact is a workspace package-manifest inventory, not a publish
  package contents SBOM and not an attested release artifact.

## Implemented In This Pass

- `pnpm sbom:generate` writes `docs/generated/sbom.cdx.json`.
- `pnpm sbom:check` fails when the checked SBOM drifts from workspace package manifests,
  package metadata, workspace dependency edges, or the symbolic `git:HEAD` provenance
  marker used by tracked generated files. The command output resolves the current commit
  at runtime.
- `pnpm verify` runs the SBOM drift check before package tests and release audit commands.
- `pnpm release:readiness` and `pnpm release:dry-run` now report the generated SBOM
  artifact as supported local dry-run evidence.

## Unsupported Or Not Claimed

- This is not `npm publish --dry-run --provenance`.
- This is not a GitHub artifact attestation.
- This is not a signed release archive.
- This is not a full transitive dependency SBOM for a built npm tarball.
- This does not remove `private: true` or make any package publish-ready.

## Refresh Triggers

- Any switch from the local generator to `npm sbom`, CycloneDX tooling, Syft, SPDX, or
  another SBOM implementation.
- Any new CycloneDX version newer than `1.7`.
- Any package contents dry-run, tarball build, provenance, or attestation implementation.
- Any release package that includes files beyond the current workspace package manifests.
