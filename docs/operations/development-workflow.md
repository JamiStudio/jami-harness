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
- A generated surface is not accepted unless it records source inputs, generation time, generator version,
  verification state, and source commit.

Until implementation packages exist, `docs/` is the source canon. As packages land, promote truth into
machine-readable manifests and generate outward-facing surfaces from those manifests.

## Local-First Verification Ladder

Run the narrowest complete checks for the touched surface:

- Docs and plans: read back changed Markdown, `pnpm docs:check`, `git diff --check`.
- Contracts and schemas: generation, drift check, schema validation, compatibility fixtures.
- Runtime/policy/tools/memory/artifacts/observability: lint, typecheck, unit tests, targeted integration
  tests, recovery or policy regression fixtures as applicable.
- CLI/SDK/workbench: command smoke, idempotency checks, clean temporary-project checks, browser smoke when UI exists.
- Full gate: `pnpm verify`.

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

## Free Tooling Bias

Prefer free/local tooling first: `pnpm`, TypeScript, Node scripts, `rg`, Mermaid, JSON Schema, OpenAPI,
Vitest/Playwright when packages exist, `git diff --check`, and generated docs from local manifests.
Paid or hosted services should be adapters, publishing targets, or fallback gates rather than the only
way to validate correctness.
