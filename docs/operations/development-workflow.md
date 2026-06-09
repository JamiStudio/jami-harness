# Development Workflow

Status: Active
Last updated: 2026-06-07

## Purpose

Keep Jami Harness development fast, uniform, and evidence-backed. Agents run checks in session
before code reaches GitHub. GitHub Actions exist as a manual fallback, not as the primary development
gate while minutes are limited.

## Source Registry

The repo should converge on a unified source registry rather than hand-maintained parallel docs.

- Contracts, schemas, package manifests, policy manifests, adapter manifests, artifact metadata, and
  accepted evidence packets own executable truth.
- Durable docs explain the source registry and generated outputs.
- Public docs, legal/support pages, marketing claims, user manuals, changelogs, architecture diagrams,
  system maps, API references, and release notes must trace back to accepted source records.
- A generated surface is not accepted unless it records source inputs, generator version,
  verification state, source commit reference, freshness class, command result, and
  generated output paths.
- Current local docs generation runs through `pnpm docs:generate` and
  `pnpm docs:generate -- --check`; outputs live under `docs/generated/` with a
  Mintlify-ready draft under `apps/docs/`.
- The registry-root current-source intake record is
  `C:\Users\james\dev\orgs\oss\registry\docs\operations\source-lock-evidence.md`. It is
  evidence for planning and dispatch, not proof that a harness implementation gate is closed.
- When harness code depends on a drift-prone protocol, package, hosted service, registry format,
  guidance document, or release tool, add repo-local source-lock evidence for the exact surface
  used: official URL, version or spec id, license/NOTICE/provenance status, hash or tarball
  integrity when applicable, command evidence, unresolved risks, and the next refresh trigger.

Until implementation packages exist, `docs/` is the source canon. As packages land, promote truth into
machine-readable manifests and generate outward-facing surfaces from those manifests.

## Local-First Verification Ladder

Run the narrowest complete checks for the touched surface:

- Docs and plans: read back changed Markdown, `pnpm docs:check`, `git diff --check`.
- Generated docs/manual/system-map/changelog surfaces: `pnpm docs:generate -- --check`
  plus `pnpm docs:check`.
- Package metadata, scripts, generated surfaces, or CI: docs checks plus the touched command or
  generator and `pnpm verify`.
- Contracts and schemas: generation, drift check, schema validation, compatibility fixtures.
- Runtime/policy/tools/memory/artifacts/observability: lint, typecheck, unit tests, targeted integration
  tests, recovery or policy regression fixtures as applicable.
- Current runtime/policy/tool package gates: `pnpm policy:test`, `pnpm runtime:test`,
  and `pnpm tools:test`.
- Current CLI/SDK package gates: `pnpm sdk:test`, `pnpm cli:test`, and
  `pnpm examples:smoke`.
- CLI/SDK/workbench: command smoke, idempotency checks, clean temporary-project checks, browser smoke when UI exists.
- Full gate: `pnpm verify`, including the non-publishing release readiness and dry-run
  audits.

Every agent final response must report the exact checks run, results, unavailable commands, commit SHA,
and push result.

## CI Posture

- CI is manual fallback for now: use GitHub Actions only when a human or coordinator intentionally
  dispatches it.
- Do not rely on CI to catch workstream failures. The worker must run the ladder before commit and push.
- Automatic PR/push CI can be enabled later when development slows or GitHub minutes are no longer a constraint.

## No Stub Completion

Do not fake progress with placeholders, hidden demo data, disabled checks, broad compatibility shims, or
weakened validation. If real user input or account action is needed, pause the stream, record the exact
intervention needed, alert the human, then continue after it is resolved. Do not patch around it.

## Diagrams And System Maps

- Architecture diagrams should be generated from source records where possible: package graph, port/adapters,
  contracts, state machines, event flows, and deployment manifests.
- Mermaid is the default durable text format for docs.
- Generated image exports are secondary artifacts and must name their source diagram.
- System maps should update in the same workstream as the source contracts or topology they describe.

## Changelog And Release Notes

- Production-meaningful changes require a short durable note once `.changes/` exists.
- Release notes are compiled from accepted fragments and evidence packets.
- Changelog entries should describe shipped behavior and verification, not aspirational status.

## Release, Supply Chain, And Public Claims

- `docs/operations/release-readiness.md` owns the current release-readiness gate.
- `pnpm release:readiness` and `pnpm release:dry-run` are audit commands. They must never
  publish, tag, deploy, or call external account APIs.
- `pnpm verify` runs both release audit commands after the package and evidence-smoke
  gates, so release-readiness checks cannot drift away from the full local gate.
- Public claims must use the release-readiness claims matrix and current command evidence.
  Unsupported surfaces should be named as unavailable instead of softened into marketing
  language.
- SBOM generation, package contents dry runs, npm provenance, GitHub attestations, and
  hosted docs deployment must have accepted command evidence before publish-ready claims.
- Account actions for npm, GitHub releases, docs hosting, Vercel, Cloudflare, or other
  hosted systems are human interventions until credentials and authorization are
  explicitly recorded.

## Free Tooling Bias

Prefer free/local tooling first: `pnpm`, TypeScript, Node scripts, `rg`, Mermaid, JSON Schema, OpenAPI,
Vitest/Playwright when packages exist, `git diff --check`, and generated docs from local manifests.
Paid or hosted services should be adapters, publishing targets, or fallback gates rather than the only
way to validate correctness.
