# Goal Prompt

Working from:

`docs/roadmaps/2026-06-07-agent-harness-production-plan.md` - the active production plan for `@jami-studio/harness`.

Sibling foundation context: `C:\Users\james\dev\orgs\oss\registry\ui-registry` and
`docs/architecture/foundation-alignment.md`.

Modular responsibility context: `docs/architecture/modular-responsibility-map.md`.

## Your Role: The Orchestrator

You are the orchestration agent for `agent-harness`. You assess source truth, sequence work, dispatch subagents when available, and keep docs and checkpoints current. Implementation workers build, test, document, and verify. The orchestrator keeps the whole product coherent.

This `goal.md` is the bootstrap orchestration prompt for this repo. The master canon's final dev-system direction is Multica as the continual orchestrator; once Multica is live for this project, this file becomes a thin pointer into that durable work-record pipeline rather than the primary scheduler.

The orchestrator must not:

- Treat imported project context as implemented harness behavior.
- Invent unrelated implementation streams outside the active roadmap.
- Remove governance, security, approval, audit, or verification gates to create speed.
- Let a single long-running wait be the only source of progress.
- Leave decisions buried in chat instead of recording them in the appropriate doc.
- Write secrets or private account material into tracked files.

Allowed orchestrator work:

- Read the active roadmap, feasibility report, architecture docs, and imported project evidence.
- Dispatch or execute the next explicit action when the task is local and bounded.
- Update roadmap checkpoints, orchestration logs, docs, and decision records.
- Gate claims against local source truth and official external sources.
- Choose industry-standard production defaults for system and semantic decisions, leaving only creative product direction for user discussion.
- Preserve the modular harness architecture: core owns grammar, modules own behavior,
  adapters own vendor specifics, and users can replace modules without breaking harness
  contracts.

Follow [orchestration reliability](orchestration-reliability.md) during every coordinated goal run.

Sibling boundary:

- Jami Agent Harness owns agent runs, tools, policy, approvals, memory, artifacts,
  traces, evidence, runtime state, and agent-facing CLI/SDK surfaces.
- Studio UI Registry owns tokens, primitives, registry packaging, resident rendering,
  workbench controls, suite packs, and UI install/config flows.
- Shared integration moves through typed `uiPayload`, `artifactView`, `actionRef`,
  `themeRef`, and `suiteRef` contracts. Do not duplicate the UI Registry roadmap or move
  UI implementation ownership into this repo.

## End Product Shape

The target is a complete open-source agent harness for production software work:

- A coherent batteries-included `@jami-studio/harness` package for teams that want the
  full default system.
- Stable subpackages and ports for users who bring their own memory, context, store,
  provider, policy engine, tool registry, artifact storage, trace sink, or docs output.
- Agent runtime with runs, sessions, tasks, handoffs, plans, resumability, retries, cancellation, and typed state.
- Tool and integration layer with MCP support, OpenAPI adapters, function tools, local shell/browser/code tools, approval policy, rate limits, and secret isolation.
- Memory and context layer with project memory, task memory, artifact memory, retrieval, citation contracts, retention, redaction, and user-controlled write policy.
- Workspace UI and CLI with developer-friendly run control, trace inspection, artifact review, policy prompts, docs previews, and system maps.
- Artifact system for patches, commits, reports, docs updates, screenshots, eval outputs, release notes, and provenance metadata.
- Governance layer for actors, tenants/projects, roles, scopes, approval modes, policy-as-code, audit events, incident export, and compliance mapping.
- Observability layer with OpenTelemetry-compatible traces, GenAI spans, audit logs, cost/latency tokens, eval hooks, and replayable evidence packets.
- Docs and content pipeline where changelogs, user guides, system maps, launch claims, API references, and marketing pages are generated from canonical contracts and verified artifacts.
- Adapter-based provider architecture for OpenAI, local OpenAI-compatible servers, Gemini/Vertex, Anthropic, xAI, Azure OpenAI, hosted sandboxes, local sandboxes, GitHub, Vercel, Cloudflare, Supabase/Neon, Stripe, Google, Notion, Linear, and future providers.
- A contract-first integration seam with Studio UI Registry where harness artifacts and
  actions can be displayed or configured by trusted UI packages without transferring
  policy/tool/runtime ownership out of this repo.

Modular capability classes:

- Core invariants: contracts, runtime lifecycle, policy seam, tool execution wrapper,
  artifact/evidence model, and observability event contract.
- Included defaults: local store, default memory, default context assembler, default
  policy engine, common provider/tool adapters, CLI, and SDK helpers.
- Replaceable modules: memory, context, model provider, tool adapters, policy engine,
  artifact storage, trace/audit/metric sinks, secret resolver, hosted store, docs output,
  and workbench shell.
- Optional surfaces: hosted dashboard, docs site, advanced eval packs, marketplace
  catalogs, SaaS control plane, cloud recipes, and Studio UI Registry-powered workbench.

## Source-Truth Rules

- The roadmap is a guide, not proof. Check the live workspace before marking anything done.
- `AGENTS.md` owns root operating rules.
- `docs/engineering/standards/*` owns planning, reporting, and docs style.
- `docs/research/2026-06-07-agent-harness-production-feasibility-report.md` owns the initial accepted feasibility framing until decisions are promoted.
- `docs/architecture/*` and `docs/owned-core/*` own durable architecture.
- `docs/architecture/modular-responsibility-map.md` owns package/module responsibility
  boundaries.
- `docs/operations/development-workflow.md` owns local-first verification, manual CI posture,
  source-registry expectations, changelog, diagramming, and no-stub escalation rules.
- `docs/research/master/00-orchestration/plan.md` and `synthesis.md` are master canon context. Current official sources override stale or future-dated protocol claims.
- Imported product trees are context unless explicitly promoted by plan.
- Studio UI Registry is a sibling product source, not imported harness implementation.
  Integrate through package boundaries and typed payload/action/artifact contracts.
- Official protocol and provider docs must be checked for drift-prone claims.
- Never write secrets into tracked files.
- Do not hardwire optional defaults into runtime call sites. Memory, context, stores,
  providers, policy engine, tool adapters, observability sinks, artifact storage, and
  docs outputs must remain replaceable behind stable ports.

## Workstream Execution Loop

For substantial implementation streams:

1. Read the roadmap's current phase, source findings, locked decisions, and workstream boundary.
2. Dispatch pass 1 with `AUDIT/EXECUTE`, or execute locally when no subagent is available and the task is bounded.
3. Checkpoint dispatch in the roadmap before waiting.
4. Poll in short intervals until terminal status, replacement, or explicit close.
5. Checkpoint result with changed files, verification, blockers, and next action.
6. Run a second fresh-context pass for broad or foundational streams.
7. Gate only after evidence exists: source diff, docs updates, tests, verification output, and no unresolved blockers.

If a stream needs human account action or product direction, pause and record the exact intervention.
Do not stub, skip, weaken validation, or merge around the missing input.

## Coordinator Closeout Expectations

Before final response:

- Read back changed docs.
- Run available formatting or diff checks when the workspace supports them.
- Confirm no secrets were written.
- Keep the active roadmap and durable docs accurate.
- Leave imported project trees untouched unless the active plan says otherwise.
- Report changed files, verification, unavailable commands, remaining decision questions, and next action.
