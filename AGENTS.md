# Agent Operating Rules

Today is June 2026. Do not rely on outdated training knowledge. There have been significant security, patterns, and best-practice updates that must be adopted. ALWAYS use official UP-TO-DATE sources.

These rules apply at the workspace root for Jami Harness work.

Canonical repo identity: `jami-harness` at `https://github.com/studio-jami/jami-harness.git`.

## Source Truth

- Read the canonical agent goal under `_ops/planning/jami-harness/agents/goal.md`
  before coordinated project work. This repo does not keep local agent prompt copies.
- Cross-repo planning (roadmaps, decisions, research, the production feasibility report and plan) is canonical in `_ops`, not this repo, per `_ops/planning/source-of-truth-policy.md`. Read the active roadmap and research under `_ops/planning/jami-harness/{roadmaps,research,decisions}/` before dispatching or executing implementation work.
- Read the shared master rebuild corpus under `_ops/planning/_research/master/` for context before changing project direction.
- The live filesystem is authoritative. Imported project docs are evidence, not proof of harness implementation.
- Read [docs/architecture/foundation-alignment.md](docs/architecture/foundation-alignment.md) before changing harness-to-UI contracts or repo-boundary decisions.
- Read [docs/architecture/modular-responsibility-map.md](docs/architecture/modular-responsibility-map.md) before changing package boundaries, adapter boundaries, or optional/default capability behavior.
- Read [docs/operations/development-workflow.md](docs/operations/development-workflow.md) before changing verification, CI, docs generation, changelog, diagramming, or release behavior.
- Keep permanent decisions in `_ops/planning/jami-harness/decisions/` (canonical) and durable architecture/operations docs in-repo. Keep active task sequencing in the `_ops` roadmaps.
- Never write secrets, API keys, tokens, connection strings with credentials, signed URLs, or private account material into tracked files.

## Working Rules

- Use PowerShell-native commands on this Windows host. Prefer `rg` for search.
- Preserve unrelated user changes and other agents' work. Move, clean, or reorganize a
  directory only when a plan explicitly calls for it, never as a side effect of other work.

## Documentation Rules

- Cross-repo planning is canonical in `_ops` under
  `_ops/planning/jami-harness/{research,roadmaps,decisions}/` (see
  `_ops/planning/source-of-truth-policy.md`). Do not keep plan, research, or feasibility
  copies in this repo.
- Orchestration guidance lives under `_ops/planning/jami-harness/agents/`. Plan/report
  standards live under `_ops/planning/_standards/`; docs standards live under
  `registry/docs/engineering/standards/docs-standards.md`. Do not add in-repo agent or
  plan/report standard files.
- Durable product architecture lives under [docs/architecture/](docs/architecture/),
  [docs/owned-core/](docs/owned-core/), and [docs/operations/](docs/operations/). `docs/` is
  the canonical product-docs source that publishes outward to the registry docs host.
- Changelog fragments live under [.changes/](.changes/). Add one for production-meaningful behavior, docs, operations, automation, or release changes.

## Modular Capability Rules

- Core contracts, runtime lifecycle, policy seam, tool execution wrapper, artifact/evidence
  model, and observability event contract are harness invariants.
- Defaults should be strong enough for real use, but memory, context, stores, providers,
  policy engine, tool adapters, trace sinks, artifact storage, and docs publishing outputs
  must stay replaceable behind stable ports.
- Adapters translate vendor/provider behavior into harness contracts. They must not define
  product grammar.
- Optional modules may be absent, but absence must degrade explicitly and never weaken
  policy, audit, artifact, evidence, or checkpoint guarantees.

## Sibling Boundary

`jami-harness` stays separate from `studio-ui`. Keep them cohesive through
typed contracts and cross-links, not duplicated roadmaps or collapsed ownership.

This repo owns agent runs, tools, policy, approvals, memory, artifacts, traces, evidence,
runtime state, and agent-facing CLI/SDK surfaces. Studio UI owns tokens, UI
primitives, registry items, resident rendering, workbench controls, workspace packs, and UI
install/config flows.

When a UI payload, artifact view, action ref, theme ref, or workspace ref contract changes,
update `docs/architecture/foundation-alignment.md` and the matching Studio UI doc. Do
not move token decisions, primitive implementation, registry packaging, or resident UI
rendering into this repo.

## Verification

- Docs-only changes: read back changed Markdown and run `git diff --check`.
- Current docs gate: `pnpm docs:check`.
- Full local gate: `pnpm verify`.
- Planning changes: confirm links resolve locally and no stale project-specific commands remain.
- Cross-repo contract changes: confirm the matching Studio UI alignment doc and
  active plan still describe the same responsibility split.
- External protocol/provider claims: verify against official sources before locking them in.
- Current official sources override stale or future-dated planning claims.
- GitHub Actions are manual fallback while minutes are limited. Do not push unverified work and expect CI to catch it.

## Execution Standard

- Agents have full access and a green light to complete requested work. Build to a sturdy,
  industry-standard, production-ready shape.
- No mocks, stubs, hidden demo paths, broad compatibility shims, weakened checks, or
  claims-only completion unless the user explicitly asks for a disposable experiment.
- Work from first principles. When a constraint, error, or surprise appears, ask why it
  exists and keep asking several layers deep until the cause leaves our control — that is
  where the real fix begins. Do not choose a deep refactor or a tactical patch until
  discovery shows the connected decisions and the direct and indirect effects.
- Keep a calculated appetite for cutting ceremony that slows velocity without improving the
  product. Never trade away integrity, security, correctness, or evidence quality for speed.
- No-cost constraint: stay within approved subscriptions, credits, and free tiers. Cost is
  approved only once the product demands it; stop and report rather than incur spend.

## Closeout

Before final response:

- Stop helper processes started during the session.
- Confirm no secrets were written to tracked files or command output artifacts.
- Keep the active `_ops` roadmap, durable docs, and changelog fragments accurate.
- Leave unrelated dirty/untracked files untouched, and preserve other agents' work.
- Report what changed, what was verified, and what could not run because the surface does
  not exist yet.
- Commit completed work: stage only the intentional changeset, use a conventional commit
  subject and body, and push to the configured remote. Do not leave completed work
  local-only unless the user asks.
