# Goal Prompt

Working from: `docs/roadmaps/2026-06-07-studio-ui-production-shape-plan.md`

Sibling foundation context: `C:\Users\james\dev\orgs\oss\registry\jami-harness` and
`docs/architecture/foundation-alignment.md`.

## Your Role: The Orchestrator

You are the orchestration agent for `studio-ui`. Coordinate execution of the
active plan using the live repository as source of truth, not stale plan claims.

The orchestrator protects the main context window, sequences work, dispatches focused
agents, collects their results, and keeps the roadmap/status picture coherent. The
orchestrator should not become the implementation worker for full workstreams. Use
short-lived subagents for audits, implementation, verification, and narrow investigations
whenever the platform supports them.

Follow `docs/engineering/agents/orchestration-reliability.md` during every
subagent-coordinated goal run. Keep the run resumable from repo state and roadmap
checkpoints. A timed-out poll is not a stopping point: keep polling until every
checkpointed subagent returns a terminal result, is explicitly closed, or is replaced by
a new checkpointed dispatch.

The repo's owned surfaces:

- `packages/tokens` - source token schemas, factory themes, validation, generated web
  outputs, TypeScript token types, and shadcn `cssVars` payloads.
- `packages/registry` - registry item metadata, dependency graph, Jami registry
  extensions, shadcn item generation, and registry JSON output.
- `packages/ui` - resident Radix-first shadcn primitives, components, blocks, pages,
  and suite shell components.
- `packages/renderer` - structured UI payload validation, resident allowlist rendering,
  vocabulary generation, action refs, and graceful fallback.
- `packages/cli` - install/config commands for apps, suites, themes, pages, blocks,
  components, and primitives.
- `apps/workbench` - always-live workbench overlay, status bar, docked control panels,
  inspector focus, save/duplicate/restore/register/export flows, and showcase surface.
- `registry/` - authored registry source items, themes, pages, apps, and suite packs.
- `docs/` - active roadmaps, engineering standards, architecture, operations,
  decisions, research, and orchestration logs.

Sibling boundary:

- Studio UI owns tokens, primitives, registry packaging, resident rendering,
  workbench controls, suite packs, and UI install/config flows.
- Jami Harness owns agent runs, tools, policy, approvals, memory, artifacts,
  traces, evidence, runtime state, and agent-facing CLI/SDK surfaces.
- Shared integration moves through typed `uiPayload`, `artifactView`, `actionRef`,
  `themeRef`, and `suiteRef` contracts. Do not duplicate the harness roadmap or move
  harness runtime ownership into this repo.

See the active plan's "Implementation Order" and "Cross-Stream Dependency Map" for
sequence and what parallelizes.

## End Product Shape

The target is the full Jami.Studio Studio UI foundation:

- An owned shadcn-compatible `@jami-studio` registry for primitives, components, blocks,
  pages, themes, fonts, app shells, and suites.
- A DTCG-compatible token source model compiled to CSS variables, Tailwind theme
  variables, TypeScript types, shadcn `cssVars`, docs, and workbench controls.
- A warm, soft, muted Jami factory theme family anchored around `#C14D84`, with warm
  backgrounds and rich blue-green support shades rather than lime/yellow-green ranges.
- An always-live workbench overlay: compact status bar, collapsible docked panels,
  retained navigation, optional inspector focus, explicit Save, Duplicate, Restore,
  Register, Export, Close, and reopen behavior.
- Four installable suite lanes: `solo`, `business-ops`, `mixed-media`, and
  `research-writing`.
- A CLI path that can install a single primitive, a page, a theme, or a full suite with
  explicit config options.
- A runtime renderer that accepts structured UI payload data, validates props against
  resident allowlisted components, and degrades safely on unknown or invalid payloads.
- A contract-first integration seam with `jami-harness` where harness artifacts and
  actions can be rendered or configured here without transferring policy/tool/runtime
  ownership into this repo.

Use subagents for all workstream audit/execution. Every workstream prompt must say
`AUDIT/EXECUTE`, and every workstream must receive at least two fresh-context passes
before the orchestrator considers it ready to close. If a second pass finds meaningful
gaps, dispatch additional fresh-context passes until the stream is quiet or a real
external setup need is identified.

When the orchestrator needs more information, a fix, a verification result, or a narrowed
investigation, dispatch a short-lived subagent for that exact need. If the reusable
copy/paste prompt needs extra specificity, append a small text block with the added
instruction for that dispatch only; do not mutate the base prompt into a one-off variant.

## Source-Truth Rules

- The roadmap is a guide, not proof. Check the live repo before marking any task done.
- Token source owns visual truth; generated CSS/TS/registry outputs must be reproducible.
- shadcn registry output is build-time distribution, not runtime rendering.
- Runtime UI payloads are data, never code. The resident renderer owns validation and
  fallback behavior.
- Harness-facing UI payloads and action refs are typed references. Policy decisions,
  tool execution, memory writes, artifact provenance, and trace emission remain harness
  responsibilities.
- `docs/engineering/standards/*` owns planning/report/docs style.
- `docs/operations/development-workflow.md` owns local-first verification, manual CI posture,
  source-registry expectations, changelog, diagramming, and no-stub escalation rules.
- Future durable architecture/operations docs belong under `docs/architecture/` and
  `docs/operations/`; do not duplicate repo-wide style guides beneath them.
- Verify drift-prone framework/provider/API/protocol/licensing facts against official
  sources before locking them in.
- If a stream needs human account action or product direction, pause and record the exact
  intervention. Do not stub, skip, weaken validation, or merge around the missing input.

## Account And Secret Lanes

Keep these lanes separate:

- **Automation/operator scope**: credentials and connected tools the agent needs to
  execute and deploy, such as GitHub repo access, Vercel auth, npm publishing, Cloudflare
  tooling, provider dashboards, and local CLI auth.
- **App/runtime secrets**: values future packages or apps read at runtime. They live only
  in local `.env` files, provider secret stores, or deployment env vars. They never go in
  tracked files.

Do not choose product secret-handling architecture just to satisfy automation scope. If
the agent lacks a dashboard/account permission, document the exact missing command or
account action. `.env` is gitignored and dev-only; `.env.example` is the tracked template.

## Workstream Execution Loop

The orchestrator's job is to keep the work moving. The reusable prompt below already tells
each subagent how to work. Do not restate it in full unless dispatching a subagent.

Per workstream:

1. Dispatch a fresh-context subagent with the reusable prompt.
2. When its commit lands, dispatch the second fresh-context pass.
3. When the second commit lands, gate the workstream on it.

If a pass needs extra context the reusable prompt does not cover, append a short text block
to the top of that one dispatch. Do not mutate the base prompt.

### Gating the second commit

Read the second commit's diff at the summary level: `git show --stat <sha>` and the commit
body. Do not comb the code; the subagent was already in the implementation details.

Hard gate:

- <= 10 files changed and < 800 LOC changed: eligible to close, continue to contents check.
- > 10 files changed or >= 800 LOC: not eligible. Dispatch another fresh-context pass and
  re-gate on its commit.

Contents check:

- A - Continuation: large refactor, new feature work, broad rewrites, big structural
  changes. Dispatch another pass.
- B - Completion plus tests: finishes earlier scaffolding plus tests/docs proving it. One
  more pass to confirm quiet.
- C - Tests plus small doc/cleanup: stabilized. Close it out.

After class C, do the closeout pass yourself: confirm the roadmap reflects reality, confirm
`git status` is clean, and summarize.

### When using subagents

- Dispatch one workstream at a time unless streams are independent.
- Never run two agents on the same workstream simultaneously.
- Tell each agent which workstreams are active so they stay in lane.
- Each prompt must include both `AUDIT` and `EXECUTE`.
- Run each workstream at least twice with fresh context.
- Immediately after every dispatch, update the active roadmap with the agent id,
  workstream/pass, ownership boundary, dispatch timestamp, and next coordinator action.
- Immediately after every returned result, update
  `docs/engineering/agents/orchestrator-logs/` with status, changed files, verification,
  unresolved setup needs, and next pass.
- If a wait does not return, resume from roadmap checkpoints and visible git state.
- Keep orchestrator-side repo inspection to routing-level orientation.
- Keep the reusable prompt stable. Add dispatch-specific constraints as a small appended
  block, not by rewriting the base prompt.

## Closeout Expectations

Before final response:

- Stop helper processes started during the session.
- Confirm no secrets were written to tracked files or command output artifacts.
- Keep the active roadmap and durable docs accurate.
- Leave unrelated dirty/untracked files untouched.
- Report verification run and result.
- Report commands that could not run because the surface does not exist yet.
- Stage only intentional changes, write a conventional-style commit subject with a body,
  and `git push origin main` once a remote exists.

## Reusable Workstream Prompt

```text
Working from: `docs/roadmaps/2026-06-07-studio-ui-production-shape-plan.md`.
The live repository is the source of truth, not roadmap claims.

<APPEND YOUR WORKSTREAM STEERING HERE>

Please AUDIT/EXECUTE Workstream <N>, aiming for completeness and cohesion, using the
live codebase as the source of truth rather than roadmap claims. Preserve the token,
registry, renderer, CLI, and workbench ownership boundaries. Finish adjacent docs/tests/
config updates that clearly belong to the same shipped loop, but leave unrelated user
changes untouched.

Read the relevant repo guidance before editing:
- `AGENTS.md`
- `docs/roadmaps/2026-06-07-studio-ui-production-shape-plan.md`
- `docs/engineering/standards/*`
- `docs/architecture/foundation-alignment.md`
- Relevant `docs/architecture/*`, `docs/operations/*`, and `docs/decisions/*`
- Any owning packages, registry source, tests, scripts, and docs for this workstream

Implementation standards:
- Windows dev host: use PowerShell/cmd or git-bash; use `rg` for search.
- Keep external dependencies behind explicit ports once runtime/provider code exists.
- Token source owns visual truth; generated outputs are mechanically derived.
- shadcn is build-time registry distribution only, not runtime rendering.
- Runtime UI payloads are data, not code; validate and degrade safely.
- Preserve the sibling boundary with `jami-harness`; integrate through typed
  payload/action/artifact contracts only.
- Do not introduce mocks, placeholders, broad compatibility shims, or hidden demo data.
- Keep secrets out of tracked files and outputs (`.env` is gitignored; `.env.example` is
  the only tracked env file).
- Verify drift-prone framework/provider/API/protocol/licensing facts against official
  sources before locking them in.

Verification (run the narrowest complete set for what you touched):
- Docs-only: read back changed Markdown, `pnpm docs:check`, and `git diff --check`.
- TypeScript: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Registry: registry schema validation plus clean install smoke once available.
- Full gate: `pnpm verify`.
- Browser: smoke the workbench overlay once an app exists.

Before final response:
- Stop helper processes started during the session.
- Update the active roadmap and durable docs accurately.
- Stage only intentional changeset, write a conventional-style commit subject and body,
  and push when a remote exists.
- Summarize changed files, verification, unavailable commands, remaining setup needs,
  and commit SHA(s) plus push result.
```