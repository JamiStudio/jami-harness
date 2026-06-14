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

## Worktree Rules

- This root may be a context workspace before it becomes a Git repository. If Git metadata is absent, continue from files and do not block on `git status`.
- Preserve imported project directories unless a plan explicitly moves or extracts material.
- Do not clean, rewrite, or reorganize `_legacy/`, `references/`, or imported product trees as a side effect of harness planning.
- Use PowerShell-native commands on this Windows host. Prefer `rg` for search.

## Documentation Rules

- The feasibility report and active plans are canonical in `_ops` under `_ops/planning/jami-harness/{research,roadmaps}/` (see `_ops/planning/source-of-truth-policy.md`); they are no longer kept in this repo.
- Orchestration guidance lives under `_ops/planning/jami-harness/agents/`. In-repo
  `docs/engineering/agents/` files are retired and ignored.
- Plan/report standards live under `_ops/planning/_standards/`; docs standards live under
  `registry/docs/engineering/standards/docs-standards.md`. In-repo plan/report standard
  files are retired and ignored.
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

- Docs-only changes: read back changed Markdown and run `git diff --check` when Git exists.
- Current docs gate: `pnpm docs:check`.
- Full local gate: `pnpm verify`.
- Planning changes: confirm links resolve locally and no stale project-specific commands remain.
- Cross-repo contract changes: confirm the matching Studio UI alignment doc and
  active plan still describe the same responsibility split.
- External protocol/provider claims: verify against official sources before locking them in.
- Current official sources override stale or future-dated planning claims.
- GitHub Actions are manual fallback while minutes are limited. Do not push unverified work and expect CI to catch it.
