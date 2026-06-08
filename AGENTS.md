# Agent Operating Rules

These rules apply at the workspace root for Jami Agent Harness work.

## Source Truth

- Read [docs/engineering/agents/goal.md](docs/engineering/agents/goal.md) before coordinated project work.
- Read the active roadmap under [docs/roadmaps/](docs/roadmaps/) before dispatching or executing implementation work.
- Read [docs/research/master/00-orchestration/plan.md](docs/research/master/00-orchestration/plan.md) and [docs/research/master/00-orchestration/synthesis.md](docs/research/master/00-orchestration/synthesis.md) for master rebuild context before changing project direction.
- The live filesystem is authoritative. Imported project docs are evidence, not proof of harness implementation.
- Read [docs/architecture/foundation-alignment.md](docs/architecture/foundation-alignment.md) before changing harness-to-UI contracts or repo-boundary decisions.
- Read [docs/architecture/modular-responsibility-map.md](docs/architecture/modular-responsibility-map.md) before changing package boundaries, adapter boundaries, or optional/default capability behavior.
- Read [docs/operations/development-workflow.md](docs/operations/development-workflow.md) before changing verification, CI, docs generation, changelog, diagramming, or release behavior.
- Keep permanent decisions in [docs/decisions/](docs/decisions/) or durable architecture/operations docs. Keep active task sequencing in roadmaps.
- Never write secrets, API keys, tokens, connection strings with credentials, signed URLs, or private account material into tracked files.

## Worktree Rules

- This root may be a context workspace before it becomes a Git repository. If Git metadata is absent, continue from files and do not block on `git status`.
- Preserve imported project directories unless a plan explicitly moves or extracts material.
- Do not clean, rewrite, or reorganize `_legacy/`, `references/`, or imported product trees as a side effect of harness planning.
- Use PowerShell-native commands on this Windows host. Prefer `rg` for search.

## Documentation Rules

- The feasibility report lives under [docs/research/](docs/research/).
- Active plans live under [docs/roadmaps/](docs/roadmaps/).
- Orchestration guidance lives under [docs/engineering/agents/](docs/engineering/agents/).
- Style standards live under [docs/engineering/standards/](docs/engineering/standards/).
- Durable product architecture lives under [docs/architecture/](docs/architecture/), [docs/owned-core/](docs/owned-core/), and [docs/operations/](docs/operations/).
- Changelog fragments live under [.changes/](.changes/). Add one for production-meaningful behavior, docs, operations, automation, or release changes.
- Public docs are prepared for Mintlify later, but `docs/` remains the canonical source until publishing setup is accepted.

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

`agent-harness` stays separate from `ui-registry`. Keep them cohesive through
typed contracts and cross-links, not duplicated roadmaps or collapsed ownership.

This repo owns agent runs, tools, policy, approvals, memory, artifacts, traces, evidence,
runtime state, and agent-facing CLI/SDK surfaces. Studio UI Registry owns tokens, UI
primitives, registry items, resident rendering, workbench controls, suite packs, and UI
install/config flows.

When a UI payload, artifact view, action ref, theme ref, or suite ref contract changes,
update `docs/architecture/foundation-alignment.md` and the matching UI Registry doc. Do
not move token decisions, primitive implementation, registry packaging, or resident UI
rendering into this repo.

## Verification

- Docs-only changes: read back changed Markdown and run `git diff --check` when Git exists.
- Current docs gate: `pnpm docs:check`.
- Full local gate: `pnpm verify`.
- Planning changes: confirm links resolve locally and no stale project-specific commands remain.
- Cross-repo contract changes: confirm the matching Studio UI Registry alignment doc and
  active plan still describe the same responsibility split.
- External protocol/provider claims: verify against official sources before locking them in.
- Current official sources override stale or future-dated planning claims.
- GitHub Actions are manual fallback while minutes are limited. Do not push unverified work and expect CI to catch it.
