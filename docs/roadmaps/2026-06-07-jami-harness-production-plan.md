# Jami Harness Production Implementation Plan

Date: 2026-06-07
Status: Active implementation
Source reports: `docs/research/2026-06-07-jami-harness-production-feasibility-report.md`; `docs/research/master/00-orchestration/plan.md`; `docs/research/master/00-orchestration/synthesis.md`; crossflow adversarial review at `C:\Users\james\dev\orgs\oss\registry\docs\research\2026-06-08-harness-ui-plan-adversarial-review.md`
Owner: Jami Studio
Surface: Jami Harness root workspace
Sibling foundation: `C:\Users\james\dev\orgs\oss\registry\studio-ui`

## Purpose

Define the full production-shaped implementation plan for `@jami-studio/harness`: the owned-core, adapter-backed agent runtime foundation for reliable agentic development, governance, artifacts, observability, memory, docs generation, and developer experience.

## Status Legend

- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked or needs decision

## Crossflow Completion Audit

2026-06-09 fresh-context harness audit result: the registry-root crossflow Stream 1-6
closure is proven only for the foundation work that now exists in this repository. The
live repo proves contracts/generation/validation, policy-denial fixtures, runtime event
spine, local memory/artifact/observability foundations, CLI/SDK local evidence smoke, and
non-publishing release-readiness audits through `pnpm verify` and the targeted commands
listed in the pass-status notes below.

Do not read the registry-root `Status: Complete` as final harness product acceptance.
The roadmap final verification and acceptance criteria remain open because the live repo
still lacks the full tool gateway, provider execution, hosted durable stores, retry/failure
recovery checkpoint fixtures, Mintlify build, SBOM
artifact generation, release attestations, publishable package manifests, and hosted
workbench/docs surfaces. The release-readiness audit intentionally reports these as
unsupported or human-intervention-gated rather than weakening the gates.

## Source Findings

- [x] The root workspace currently has imported project context but no prior root `docs/` canon.
- [x] Imported `evals` docs provide reusable orchestration, planning, docs, and report standards.
- [x] Prior harness framing established the owned-core thesis: own product grammar and contracts; put vendors behind adapters.
- [x] `docs/architecture/modular-responsibility-map.md` establishes the packaging thesis: core owns grammar, modules own behavior, adapters own vendor specifics, and users can replace modules without breaking harness contracts.
- [x] The registry-root source-lock record originally selected MCP baseline `2025-06-18`;
  Workstream 4 MCP source-lock pass 1 refreshed the harness-local implementation lock in
  `docs/operations/mcp-source-lock.md` to official MCP `2025-11-25`, current latest as
  verified on 2026-06-09. Streamable HTTP, authorization, tool safety, elicitation,
  sampling, roots, consent, origin validation, and local-binding safeguards remain
  directly relevant and must be refreshed before any broader MCP implementation.
- [x] Master canon identifies `@jami-studio/harness`, `@jami-studio/ui`, and `@jami-studio/orchestra` as the `jami.studio` foundation repos.
- [x] `docs/architecture/foundation-alignment.md` records the repo split: Jami Harness owns governed agent execution, tools, policy, memory, artifacts, traces, and agent-facing runtime surfaces; Studio UI owns UI, tokens, renderer, registry, workbench, suites, and UI install surfaces.
- [x] Master canon selects agent-native as the preferred OSS foundation substrate, pending current lock-time verification.
- [x] Crossflow adversarial review found the prior agent-native package targets stale as of 2026-06-08:
  current npm metadata showed `@agent-native/core@0.40.1` and `@agent-native/dispatch@0.9.3`; those
  observations are evidence inputs, not durable pins, and must be refreshed at runtime source-lock time.
- [x] Official OpenAI Agents SDK docs support tools, handoffs, guardrails, sessions, and tracing patterns, but should inform adapters rather than own the product grammar.
- [x] OpenTelemetry GenAI semantic conventions, OWASP LLM/agent guidance, NIST AI RMF/Generative AI Profile, OpenAPI, SLSA/GitHub attestations, and Mintlify docs all shape production requirements.

## Locked Decisions

- [x] The harness owns product semantics and contracts.
- [x] Provider/framework choices remain adapter-backed.
- [x] Package identity is `@jami-studio/harness`; public binary naming follows the accepted `@jami-studio` convention unless the creative naming sweep changes it.
- [x] agent-native is the preferred starting foundation if current official/package/license verification still matches the master report at lock time.
- [x] A2A is the inter-agent interop target; MCP is the tool/data interop target; native SSE and AG-UI both exist in the agent-to-UI strategy.
- [x] Runtime governance uses one default-deny `policyCheck()` seam over a replaceable engine.
- [x] Docs, changelogs, system maps, user guides, and marketing claims flow from one canon source.
- [x] MCP support is required, with the latest official spec tracked as a protocol compatibility target.
- [x] OpenTelemetry-compatible traces are required.
- [x] Security, policy, consent, approval, and audit are foundational requirements, not later embellishments.
- [x] Public docs will be prepared for Mintlify, but the repo docs tree remains source canon until publishing setup is accepted.
- [x] Jami Harness and Studio UI remain separate sibling repos. Cohesion comes from shared typed contracts and cross-links, not from merging planning work into one repository.
- [x] The full harness ships a coherent batteries-included path through `@jami-studio/harness`, while memory, context, stores, providers, policy engine, tool adapters, observability sinks, artifact storage, and docs publishing remain replaceable behind stable ports.

## Scope Boundaries

- This plan designs the official production product shape and execution sequence.
- Imported project directories are context sources, not automatically harness-owned packages.
- Secrets can be used from the developer environment during implementation, but never committed.
- Studio UI owns UI primitives, tokens, registry packaging, resident rendering, suite UI, and UI install flows. The harness may reference those surfaces through typed contracts, but does not own their implementation.
- Memory and context are harness-owned contracts, not forced implementations. Users may bring their own memory, retrieval, search, context assembler, or knowledge graph as long as the adapter preserves policy, citation, freshness, provenance, and replay requirements.
- Creative direction decisions stay open for user discussion. System architecture defaults are recommended here.

## Repo Guidance

- Read `AGENTS.md` before edits.
- Use `docs/engineering/agents/goal.md` for coordinated runs.
- Use `docs/engineering/standards/*` for plan/report/docs style.
- Keep root docs stable and durable.
- Keep external claims linked to official sources in reports or decision records.
- Create implementation packages only after the plan is accepted or explicitly started.
- Preserve cross-repo alignment by linking sibling docs instead of duplicating full plans. When a shared contract changes, update `docs/architecture/foundation-alignment.md` here and the matching Studio UI doc.
- Preserve modular responsibility boundaries from `docs/architecture/modular-responsibility-map.md`. Do not hardwire optional defaults into runtime call sites.
- Use `C:\Users\james\dev\orgs\oss\registry\docs\operations\source-lock-evidence.md`
  as the registry-root current-source intake record. It does not close implementation gates
  by itself; code lanes must add repo-local, command-backed source-lock evidence for the
  exact dependency or protocol surface used.

## Verification Ladder

Run the narrowest complete check set for the touched surface.

- Docs-only changes: read back changed Markdown, run `pnpm docs:check`, and run
  `git diff --check`.
- Package metadata, script, generated-surface, or CI changes: run the docs-only checks,
  the touched command or generator, and `pnpm verify`.
- Contracts and schemas: run generation, drift checks, schema validation, and shared
  compatibility fixtures once those commands exist.
- Runtime, policy, tools, memory, context, search, artifacts, observability, CLI, SDK, or
  workbench code: run lint, typecheck, tests, targeted integration/security fixtures, and
  `pnpm verify` once those commands exist.
- GitHub Actions are a manual fallback while minutes are limited. Local verification is
  required before push.

## Target Harness Shape

- `packages/contracts` - canonical schemas, generated JSON Schema/OpenAPI, type exports.
- `packages/core` - composition layer that wires contracts, runtime, policy, tools, memory, context, artifacts, observability, and stores through stable ports.
- `packages/runtime` - agent-native-derived and harness-owned run lifecycle, state machine, checkpoints, retries, cancellation, handoffs, and port-based runtime composition.
- `packages/policy` - roles, scopes, approvals, policy evaluation adapter, secret references, and default policy engine.
- `packages/tools` - tool registry, shared execution envelope, MCP/OpenAPI/function tool adapters, risk labels, execution wrappers.
- `packages/memory` - memory taxonomy, citation contracts, retention/redaction policy, no-op/local/default modules, and external memory adapter port.
- `packages/context` - context source model, token budget planning, source ranking, compression adapters, citation-preserving assembly, and replaceable strategy port.
- `packages/search` - local and hosted retrieval adapter interfaces plus default search modules.
- `packages/artifacts` - artifact model, provenance, promotion, changelog/doc/source-map emitters, and replaceable storage/rendering ports.
- `packages/observability` - traces, audit events, OpenTelemetry bridge, metrics, evidence packets, and replaceable sinks.
- `packages/store-*` - durable run, artifact, memory, trace, and config persistence adapters.
- `packages/provider-*` - model/provider adapters behind the harness model port.
- `packages/sdk` - developer SDKs and generated clients.
- `apps/cli` - `jami` CLI for run, inspect, resume, docs, map, release, and verify workflows.
- `apps/workbench` - local/hybrid UI for run control, artifacts, traces, approvals, docs previews.
- `apps/docs` or publishing config - Mintlify-ready docs shell once canon is stable.
- `examples/` - complete runnable examples for local, hosted, MCP, docs generation, and policy flows.
- `tests/` and `evals/` - contract, integration, security, docs generation, and agent-run regression tests.

## Modular Packaging Model

The harness packages capabilities by responsibility, not by vendor.

Core invariants:

- Contracts.
- Runtime lifecycle.
- Policy seam.
- Tool execution wrapper.
- Artifact/evidence model.
- Observability event contract.

Included defaults:

- Local durable store.
- Local artifact store.
- Default memory module.
- Default context assembler.
- Default policy engine.
- Common provider/tool adapters.
- CLI and SDK helpers.

Replaceable modules:

- Memory store and retrieval.
- Context assembly and compression.
- Model provider and routing.
- Tool adapters and registries.
- Policy engine.
- Artifact storage.
- Trace, audit, metric, and eval sinks.
- Secret reference resolver.
- Hosted store.
- Docs publishing output.
- Workbench/dashboard shell.

Optional surfaces:

- Hosted dashboard.
- Mintlify publishing shell.
- Advanced eval packs.
- Marketplace/provider catalogs.
- SaaS control plane.
- Organization/team admin.
- Cloud deployment recipes.
- Studio UI-powered workbench UI.

The main `@jami-studio/harness` package should give users the full coherent default. The
subpackages should let advanced users replace memory, context, policy, providers, stores,
tools, observability, artifacts, and docs output without forking the runtime.

## Sibling Foundation Boundary

`jami-harness` and `studio-ui` are separate `@jami-studio/*`
foundation repositories.

Jami Harness owns agent runs, tools, policy, approvals, memory, artifacts, traces,
evidence, runtime state, and agent-facing CLI/SDK surfaces.

Studio UI owns tokens, UI primitives, registry packaging, suite composition,
resident rendering, the always-live workbench, and UI install/config flows.

Shared integration is contract-first:

- `uiPayload` for validated resident rendering.
- `artifactView` for harness artifacts rendered through trusted UI components.
- `actionRef` for policy-gated agent/tool actions exposed by UI slots.
- `themeRef` for factory/custom theme references.
- `suiteRef` for suite install graphs and optional harness capabilities.

Do not duplicate the Studio UI roadmap in this repo. Link to the sibling plan and
update shared contract docs when integration decisions change.

## Cross-Stream Dependency Map

Contracts, ports, and policy language come first. Runtime composes against ports for
store, model, policy, tools, memory, context, artifacts, and observability. Tool gateway,
memory, context, search, and artifacts consume those contracts. Observability wraps all
execution through event contracts and replaceable sinks. CLI/workbench and docs generation
consume the stable primitives. Release/provenance and public docs close the loop. Shared
UI payload/action/artifact references align with Studio UI after the harness
contracts can express provenance and policy.

## Adversarial Hardening Gates

These gates convert the crossflow adversarial review into execution criteria. They are part of the
active plan, not optional research notes.

- `path-lock`: active plans, boundary docs, package metadata, and dispatch prompts must point to the
  registry-root `jami-harness` and `studio-ui` checkouts and canonical `JamiStudio/*` remotes; closure
  requires a search/readback or equivalent path-lock evidence note.
- `source-lock`: before runtime, protocol, package, or third-party source implementation, capture the
  official/current source, package/spec name, version or spec identifier, date, license/provenance state,
  tarball or commit evidence where applicable, and unresolved risks. The root current-source record is
  `C:\Users\james\dev\orgs\oss\registry\docs\operations\source-lock-evidence.md`; implementation rows
  must become checked-in source-lock records before code depends on the source.
- `compat-lock`: shared UI/action/artifact/theme/suite references must have machine-readable schemas or
  fixtures consumed by both this repo and `studio-ui`; the gate is closed only by commands that fail on
  schema drift or missing negative fixtures once those commands exist.
- `policy-lock`: prompt-injection, tool-metadata poisoning, MCP transport abuse, secret exfiltration,
  approval replay, denied action, and redaction fixtures must fail closed and produce audit/evidence
  records.
- `adapter-lock`: every adapter declares supported, unsupported, denied, trace, auth, streaming,
  cancellation, and resumability behavior, with one positive, denied, unsupported, and trace/evidence
  fixture per adapter.
- `token-lock`: harness-side `themeRef` and `suiteRef` compatibility cannot close until Studio UI token
  schema/version, alias, deprecation, composite-token, invalid-reference, and deterministic-output
  fixtures are represented in the shared compatibility set.
- `renderer-lock`: harness-originated UI payload/action/artifact refs must prove that Studio UI renders
  only resident allowlisted components, fails closed on unknown or unsafe payloads, and displays denied
  action states without executing policy-owned side effects.
- `cli-lifecycle-lock`: harness CLI/workbench integration cannot assume Studio UI install state unless
  install, update, remove, migrate, doctor, pin/lock, conflict handling, rollback guidance, and provenance
  inspection are covered by Studio UI temp-project smokes or shared evidence.
- `a11y-visual-lock`: harness workbench or artifact UI integration cannot close on prose-only UI quality;
  accepted Studio UI fixtures must cover keyboard, focus, ARIA, contrast, reduced motion, responsive,
  long-content, disabled/loading/invalid/empty/error states, and multi-theme evidence.
- `evidence-lock`: generated docs, changelogs, system maps, and public claims must link to source commit,
  accepted contract, command evidence, timestamp, and freshness class once evidence schemas exist.
- `supply-chain-lock`: source/license provenance, SBOM policy, and release attestation requirements start
  before code is lifted or forked, not only during final release; package publishing, static registry
  hosting, and release attestation tooling need dry-run or capability evidence before public claims.

## Workstream 1: Canonical Contracts And Primitive Registry

Goal: Define the harness-owned contract vocabulary and composable primitive registry on top of the accepted `@jami-studio/harness` foundation boundary.

Pass status:

- 2026-06-09 Stream 2 contract spine, harness lane, pass 1 added the first
  dependency-free `packages/contracts` scaffold with JSON Schema anchors and
  compatibility fixtures for `runEvent`, `uiPayload`, `artifactView`, `actionRef`,
  `themeRef`, `suiteRef`, `capabilityManifest`, and `primitiveManifest`.
- 2026-06-09 Stream 2 contract spine, harness lane, pass 2 hardened the contract
  validation gate with required fixture coverage for every current anchor, schema
  reference containment, fixture metadata checks, and semantic negative cases for
  denied-action evidence, renderer error state, unsafe UI payload props, and Studio UI
  suite item references.
- 2026-06-09 Stream 2 contract spine, harness lane, pass 4 added checked generated
  contract artifacts (`contracts.ts`, OpenAPI components, and reference manifest),
  first evidence packet and threat-model fixture catalog anchors, and drift checks in
  the contract validation/verify path.
- 2026-06-09 Stream 3 policy runtime and safe rendering, harness lane, pass 1 added
  policy, approval, audit, and secret-reference contract anchors plus generated artifacts
  and negative fixtures for prompt injection, tool metadata poisoning, MCP transport
  abuse, secret exfiltration, cross-scope actions, approval replay, denied action audit state, and
  secret-reference redaction.
- 2026-06-09 Stream 3 policy runtime and safe rendering, harness lane, pass 2 hardened
  malformed policy request handling so default-deny decisions still produce typed
  denial/audit evidence when run, actor, project, environment, risk, or scope inputs
  are missing or invalid.
- 2026-06-09 Stream 3 policy runtime and safe rendering, harness lane, pass 3 added
  the first `packages/runtime` kernel for typed run lifecycle events, data-only
  `uiPayload` and `artifactView` emission, and policy-gated `actionRef` emission that
  fails closed on malformed, poisoned, replayed, secret-inline, or denied action
  requests.
- 2026-06-09 Stream 4 memory/context/observability/artifacts/evidence, harness lane,
  pass 1 added `artifactRecord`, `traceEvent`, `memoryRecord`, and `contextPack`
  contract anchors with generated references and fixtures. The pass also added local
  package foundations for artifact provenance, runtime evidence export, trace/audit
  references, memory permission filtering, citation freshness, retention/redaction, and
  deterministic context replay. These are not full hosted artifact stores, OpenTelemetry
  exporters, vector search backends, docs generators, CLI surfaces, or workbench views.
- 2026-06-09 Stream 4 pass 2 hardened artifact/evidence provenance by requiring source
  repo, commit, and ref fields on artifact records, artifact views, and evidence packets;
  accepted evidence contracts now record name plus schema version, and runtime artifact
  view emission fails closed when required provenance is missing.
- Root verification now runs `pnpm contracts:validate` through `pnpm verify`.
- The workstream remains open because broad run/task/tool/docs/release schemas, core
  ports, primitive lifecycle/versioning docs, and cross-repo Studio UI consumer fixtures
  are not implemented yet.

Depends on:

- [x] Charter and feasibility framing.

Enables:

- [ ] Runtime, tools, memory, artifacts, observability, SDKs, docs generation.

Primary areas:

- `packages/contracts`
- `docs/owned-core`
- `docs/architecture`

Implementation tasks:

- [~] Add run, task, plan, actor, project, environment, tool, policy, approval, artifact, memory, trace, audit, evidence, docs-source, and release-packet schemas.
- [x] Add harness-side schema anchors for `runEvent`, `uiPayload`, `artifactView`, `actionRef`, `themeRef`, and `suiteRef` references without importing UI implementation ownership.
- [ ] Define core ports for model, store, policy, tools, memory, context, search, artifacts, observability, secrets, docs output, and UI references.
- [x] Define capability manifest format so modules can declare supported features, required scopes, failure modes, and replacement compatibility.
- [x] Generate JSON Schema and TypeScript exports.
- [x] Define primitive registry manifest format.
- [~] Add contract tests and schema compatibility checks, including shared fixtures for unsupported UI components, invalid payloads, denied actions, and renderer error states.
- [x] Define the initial threat model fixture catalog for policy/tool/UI/action/memory/evidence risks.
- [x] Define the evidence packet schema before docs-generation work consumes evidence claims.
- [~] Define artifact, trace, memory, and context record schemas before hosted backends or
  docs generation consume them.
- [ ] Document primitive lifecycle and versioning.

Exit criteria:

- [~] Contracts build, validate, and generate docs/reference artifacts.
- [ ] Ports make module replacement explicit without weakening core policy, audit, artifact, evidence, or checkpoint contracts.
- [ ] Shared harness/UI compatibility fixtures can be consumed by both this repo and `studio-ui`.
- [ ] Evidence packet and threat model schemas exist before runtime, gateway, memory, or docs generation work builds on them.

Suggested verification:

- `pnpm test --filter @jami-harness/contracts`
- `pnpm docs:generate -- --check`
- `pnpm contracts:generate:check`

## Workstream 2: Runtime Kernel And Checkpointing

Goal: Fork/adopt the verified agent-native runtime substrate, then harden the run lifecycle and durable resumability model behind harness-owned contracts.

Pass status:

- 2026-06-09 Stream 3 policy runtime and safe rendering, harness lane, pass 3 added
  `@jami-studio/harness-runtime` as a dependency-light runtime spine. It emits typed
  `runEvent` records for start/progress/complete/fail, `ui.payload.emitted`,
  `artifact.created`, `policy.decision`, and allowed `tool.call.requested` references.
  Action emission runs through the existing policy kernel and denied or malformed action
  requests stay display-only. This is not the full provider runtime, full tool gateway,
  durable checkpoint store, memory/context/search integration, observability sink, CLI,
  or real agent execution loop.
- 2026-06-09 Stream 4 pass 1 connected the runtime spine to injectable event and audit
  sinks through `@jami-studio/harness-observability` tests, so a local evidence packet can
  be exported from captured runtime events without hosted observability. Runtime call
  sites still do not own memory/context/search integration, tools, providers, durable
  checkpointing, CLI, or real agent execution.
- 2026-06-09 post-audit implementation pass 1 added `@jami-studio/harness-store-local`
  with in-memory and filesystem checkpoint stores, redacted replay hashes, local approval
  records, path-safe checkpoint reads/writes, SDK checkpoint/resume/approve APIs, and CLI
  `resume`, `approve`, and `doctor` evidence surfaces. This closes only the local
  checkpoint/resume foundation; retry/cancellation/failure recovery, hosted stores,
  provider runtime, and full agent execution remain open.

Depends on:

- [ ] Workstream 1 contracts.

Enables:

- [ ] Tool gateway, workflow execution, CLI run control, observability.

Primary areas:

- `packages/runtime`
- `packages/core`
- `packages/artifacts`

Implementation tasks:

- [~] Implement run/session/task state machine.
- [ ] Produce a source-lock report for agent-native before adoption or fork work: exact scoped package names, current versions, dist-tags, repository commit or tarball evidence, license/NOTICE files, transitive dependency review, and fork-delta rationale.
- [ ] Preserve upstream MIT notices and add Apache-2.0 foundation licensing as accepted.
- [~] Add turn streaming, cancellation, retry, timeout, handoff, and checkpoint semantics.
- [~] Add local durable store adapter and hosted-store interface; local filesystem and
  in-memory checkpoint stores exist, hosted/database stores remain unsupported.
- [~] Compose runtime against replaceable model, store, memory, context, policy, tool, artifact, observability, and secret-resolver ports; SDK composition now covers store/memory/context/search/policy/artifact/observability/tool foundations, while model/provider and secret-resolver composition remain open.
- [~] Add explicit capability checks for optional modules so absent memory/context/search/docs sinks degrade clearly.
- [~] Add recovery from checkpoint with evidence preservation; local `resume` reports replay status and hash, while retry/cancellation/failure recovery fixtures remain open.
- [~] Add runtime contract tests and simulated failure recovery tests.

Exit criteria:

- [~] A run can start, emit UI/action/artifact references, fail, and close with typed events.
- [~] Runtime/SDK call sites do not assume default memory, context, store, or observability implementations for the current local foundation; provider and secret-resolver ports remain open.
- [ ] No public harness contract imports agent-native package types directly.
- [~] Runtime checkpoint/resume evidence has local replay/redaction checks; retry, cancellation, and failure recovery fixtures remain open.

Suggested verification:

- `pnpm test --filter @jami-harness/runtime`

## Workstream 3: Policy, Identity, And Approval

Goal: Make actor identity, scopes, approval, and policy enforcement foundational.

Depends on:

- [ ] Workstream 1 contracts.

Enables:

- [ ] Tool execution, MCP authorization, artifact promotion, hosted control plane.

Primary areas:

- `packages/policy`
- `docs/operations`
- `docs/architecture`

Implementation tasks:

- [~] Define actor/project/environment/role/scope model.
- [~] Implement approval modes and policy decisions.
- [x] Add secret-reference contracts with no-value leakage.
- [~] Add adapter for a policy engine while keeping harness vocabulary canonical.
- [~] Ship a default rules-based policy engine while preserving a stable policy-engine replacement port.
- [~] Add audit events for all policy decisions.
- [~] Add negative fixtures for prompt injection, tool metadata poisoning, approval replay, cross-scope action attempts, secret exfiltration attempts, and UI denied-action states.

Pass status:

- 2026-06-09 Stream 3 policy runtime and safe rendering, harness lane, pass 1 added
  `packages/policy` with a dependency-free default-deny engine, a small policy-gated
  run helper, and tests for scope denial, approval requirements, approval replay/expiry,
  prompt injection, tool metadata poisoning, MCP Streamable HTTP transport controls,
  secret exfiltration, secret value redaction, and denied-action audit emission.
- 2026-06-09 Stream 3 policy runtime and safe rendering, harness lane, pass 2 added
  closed-state evidence sentinels for malformed policy requests and tests proving the
  helper returns non-executable, typed denial/audit references instead of malformed
  contract records.
- 2026-06-09 Stream 3 policy runtime and safe rendering, harness lane, pass 3 connected
  the policy package to the new runtime action emission path and added runtime negative
  tests for prompt-injection-like metadata, tool metadata poisoning, malformed action
  refs, secret-inline attempts, approval replay, and denied actions.
- The contract spine now includes `policyDecision`, `approvalRequest`, `auditEvent`, and
  `secretRef` anchors and generated outputs. Studio UI still needs matching renderer-side
  denied-state consumer fixtures in its lane; this harness pass did not edit Studio UI.

Exit criteria:

- [ ] Sensitive tool and artifact actions cannot execute without an explicit allow decision.
- [ ] Policy denial, redaction, approval expiry, and audit evidence are covered by failing-closed tests.

Suggested verification:

- `pnpm test --filter @jami-harness/policy`

## Workstream 4: Tool And Integration Gateway

Goal: Provide safe, typed, observable tool access across MCP, A2A interop boundaries, OpenAPI, function tools, shell/browser/code tools, and provider adapters.

Depends on:

- [ ] Workstream 1 contracts.
- [ ] Workstream 3 policy.

Enables:

- [ ] Real agent execution, integrations marketplace, docs generation from tool contracts.

Primary areas:

- `packages/tools`
- `packages/runtime`
- `docs/operations`

Pass status:

- 2026-06-09 Workstream 4 pass 1 after the overclaim audit added the first
  `@jami-studio/harness-tools` foundation: an in-memory replaceable tool registry, risk
  labels, one policy-gated execution envelope, a real function-tool adapter path,
  timeout/cancellation status, typed `toolExecution` contract records, trace/audit/
  evidence/artifact output, redaction for secret-like inputs and results, SDK/CLI
  capability inspection, and adapter capability manifests. At that pass, MCP, OpenAPI,
  shell, browser, code, provider, and A2A adapters were explicit unsupported capability
  manifests and failed closed until repo-local source-lock evidence and adapter fixtures
  existed.
- 2026-06-09 Workstream 4 pass 2 confirmation found and fixed narrow hardening gaps:
  replaceable policy-engine failures now fail closed into typed denied tool execution
  evidence without invoking handlers, non-cooperative function tools cannot outlive the
  timeout envelope, and failed-tool error messages are redacted before trace and artifact
  payloads record them.
- 2026-06-09 Workstream 4 MCP source-lock pass 1 refreshed repo-local MCP evidence to
  official `2025-11-25` and added a narrow trusted in-process MCP fixture adapter. The
  supported path maps MCP `initialize`, `tools/list`, and `tools/call` into the existing
  policy-gated execution envelope, validates tool metadata before registration, rejects
  poisoned metadata and unsupported protocol versions, and represents Streamable HTTP
  Origin/session/protocol-version/local-binding guards as fail-closed validation. This is
  not stdio subprocess transport, remote Streamable HTTP, OAuth, resources, prompts,
  roots, sampling, elicitation, tasks, resumability, or full MCP SDK parity.

Implementation tasks:

- [x] Implement tool registry and risk labels.
- [~] Normalize MCP, OpenAPI, function, shell, browser, code, and provider tools through one execution envelope for status reporting; function tools and trusted in-process MCP fixture tools have executable adapter paths, while OpenAPI/shell/browser/code/provider/A2A and remote MCP surfaces fail closed as unsupported.
- [~] Add MCP client support for stdio and Streamable HTTP; trusted in-process fixture discovery/call mapping is implemented, while stdio subprocess and remote Streamable HTTP transports remain unsupported.
- [ ] Add A2A agent-card/task interop where cross-agent communication is required.
- [~] Add origin/session/auth controls for HTTP transports, including MCP Streamable HTTP origin and localhost-binding safeguards where applicable; guard validation exists for Origin, visible-ASCII session id, protocol version, and public local binding, while remote HTTP transport and OAuth remain unsupported.
- [~] Add OpenAPI/function tool adapters; function tools are implemented, OpenAPI remains unsupported until current source-lock evidence and fixtures exist.
- [ ] Add local shell/browser/code wrappers with sandbox policy.
- [~] Add tool-call approval, timeout, cancellation, trace, and audit events; the foundation covers approval through the policy seam and represents timeout/cancellation status, but streaming and resume semantics remain open.
- [~] Add adapter capability manifests for streaming, cancellation, resumability, auth model, tool result shape, artifact support, error taxonomy, trace propagation, policy hooks, and unsupported states; the MCP manifest now distinguishes trusted fixture support from unsupported stdio, Streamable HTTP, OAuth, resources, prompts, roots, sampling, elicitation, tasks, and resumability.

Exit criteria:

- [~] Tools execute only through policy, emit traces/audit, and produce typed artifacts for the current function-tool and trusted MCP fixture foundations.
- [~] Every adapter has positive, denied, unsupported, and trace/evidence fixtures for the current foundation; the MCP trusted fixture path now has positive and denied coverage, while remote protocol support remains open.

Suggested verification:

- `pnpm tools:test`
- `pnpm contracts:validate`
- MCP compatibility smoke against trusted local fixture server after MCP source-lock evidence and adapter implementation exist; current pass covers the trusted in-process fixture path through `pnpm tools:test`.

## Workstream 5: Memory, Context, Search, And Citation

Goal: Implement owned memory, context, search, retrieval, and citation contracts with
replaceable default modules.

Depends on:

- [ ] Workstream 1 contracts.
- [ ] Workstream 3 policy.

Enables:

- [ ] Reliable context reuse, docs generation, evidence replay, cross-project learning.

Primary areas:

- `packages/memory`
- `packages/context`
- `packages/search`

Pass status:

- 2026-06-09 Stream 4 memory/context/observability/artifacts/evidence, harness lane,
  pass 1 added `@jami-studio/harness-memory` with a no-op memory port, in-memory
  development port, permission-scoped search, citation freshness, retention filtering,
  redaction defaults, and deterministic context pack hashes. This is a replaceable local
  foundation only; durable memory stores, vector search, hosted retrieval, compression,
  external RAG adapters, policy-engine integration, and recall evals remain open.
- 2026-06-09 post-audit implementation pass 1 added explicit no-op and memory-backed
  search adapter ports plus a replaceable context assembler with token-budget drops,
  inclusion reasons, citation metadata, deterministic replay hashes, and negative tests
  for cross-actor leakage and sensitive memory omission. Hosted/vector retrieval,
  compression, external RAG provider runtime, policy-engine integration, and recall evals
  remain open.

Implementation tasks:

- [~] Define project/task/artifact memory taxonomy.
- [~] Define context source taxonomy for pinned, system-required, retrieved, compressed, tool-output, artifact, and user-provided context.
- [~] Add write policy, retention, redaction, and source attribution.
- [x] Add no-op memory and no-op search adapters for stateless users.
- [~] Add local default memory/search modules for development.
- [~] Add external memory/search adapter interfaces for user-owned RAG, vector database, graph, or retrieval systems; owned port shape exists for local/no-op adapters, hosted/vector implementations remain open.
- [x] Add context assembly strategy interface with token budget, freshness, permission, priority, inclusion/exclusion reason, and citation metadata.
- [~] Add retrieval adapters for local and hosted search; local memory-backed and no-op search adapters exist, hosted retrieval remains open.
- [x] Add citation and freshness metadata to every recalled item.
- [~] Add eval fixtures for recall precision and permission filtering.
- [~] Add privacy and replay fixtures for data classes, retention, forgetting/redaction, permission leakage, inclusion reasons, and deterministic context pack hashes.

Exit criteria:

- [ ] Memory reads and writes are policy-gated, cited, redactable, and replayable.
- [ ] Runs can execute with no memory module configured.
- [~] Context assembly is replaceable and replayable from evidence for the local foundation.
- [~] User-owned memory/search/context systems can integrate through current ports without changing SDK runtime call sites; hosted/vector adapters remain open.
- [~] Cross-project or cross-actor memory leakage attempts fail closed in current memory/context fixtures.

Suggested verification:

- `pnpm test --filter @jami-harness/memory`

## Workstream 6: Artifacts, Docs, Changelog, And System Map Canon

Goal: Make generated project surfaces flow from accepted harness artifacts.

Depends on:

- [ ] Workstream 1 contracts.
- [ ] Workstream 2 runtime.
- [ ] Workstream 7 observability.

Enables:

- [ ] Mintlify publishing, public claims, release notes, user guides, support docs.

Primary areas:

- `packages/artifacts`
- `packages/docs`
- `packages/store-*`
- `docs/operations`

Pass status:

- 2026-06-09 Stream 4 memory/context/observability/artifacts/evidence, harness lane,
  pass 1 added `@jami-studio/harness-artifacts` with an in-memory storage port default,
  artifact provenance records, secret-adjacent payload omission, and `artifactView`
  projection for Studio UI display. This is not the full filesystem/object storage,
  artifact promotion workflow, docs/changelog/system-map generation, hosted store, or
  release-packet implementation.
- 2026-06-09 Workstream 6 / Workstream 9 docs-source pass 1 added
  `@jami-studio/harness-docs` as a deterministic local generator. It consumes package
  manifests, contract schemas and generated references, accepted compatibility/policy/tool/
  artifact/memory/observability fixtures, `.changes/` fragments, release readiness policy,
  and CLI/SDK docs. It emits generated quickstart, user manual, API/reference summary,
  system map, changelog draft, claims/evidence index, docs-source manifest, and a
  Mintlify-ready `apps/docs/docs.json` plus MDX draft. The pass wires
  `pnpm docs:generate -- --check` into `pnpm verify` and release-readiness audits. It
  does not claim Mintlify CLI build, hosted docs publishing, SBOM generation, package
  publishing, or public docs hosting.

Implementation tasks:

- [~] Define artifact promotion states and provenance metadata.
- [~] Define artifact storage port and default local storage module.
- [~] Generate changelog entries, user guide deltas, system maps, and API references from accepted artifacts; current pass consumes accepted source records and fixtures, but not completed-run release packets.
- [~] Keep docs/changelog/system-map publishing outputs replaceable while preserving provenance; current outputs are local generated files and a Mintlify-ready draft.
- [x] Add docs-source manifests and verification gates.
- [x] Add Mintlify-ready navigation generation.
- [~] Add claim registry for marketing and public docs; current claims/evidence index is generated from release-readiness and accepted source records, not a full marketing registry.
- [~] Require generated docs/changelog/system-map outputs to include source commit, accepted contract, command result, timestamp, freshness class, and generated output paths; current manifest uses symbolic `git:HEAD`, a source input hash, command result, freshness class, accepted contract/evidence references, and output paths to avoid post-commit drift.

Exit criteria:

- [ ] A completed run can produce verified docs/changelog/system-map artifacts tied to source evidence.
- [ ] Generated surfaces cannot be accepted without evidence provenance.

Suggested verification:

- `pnpm docs:generate -- --check`
- `pnpm test --filter @jami-harness/artifacts`

## Workstream 7: Observability, Audit, Evidence, And Evals

Goal: Provide vendor-neutral inspection and quality loops for every run.

Depends on:

- [ ] Workstream 1 contracts.
- [ ] Workstream 2 runtime.
- [ ] Workstream 3 policy.

Enables:

- [ ] Developer trust, compliance, regression testing, support, incident response.

Primary areas:

- `packages/observability`
- `packages/store-*`
- `tests`
- `evals`

Pass status:

- 2026-06-09 Stream 4 memory/context/observability/artifacts/evidence, harness lane,
  pass 1 added `@jami-studio/harness-observability` with runtime event/audit sinks,
  minimal trace records, default redaction, artifact-backed local evidence packet export,
  and tests proving evidence export can consume the existing runtime run-event spine. This
  is not the OpenTelemetry bridge, hosted trace/audit/metric backend, eval sink, CLI
  inspector, workbench view, or complete metrics pipeline.

Implementation tasks:

- [~] Implement OpenTelemetry-compatible traces with GenAI span vocabulary.
- [~] Add audit event stream and evidence-packet export.
- [~] Separate trace/audit/metric/evidence event contracts from sink adapters.
- [~] Add local evidence packet sink and OTel bridge as defaults.
- [ ] Add cost/latency/token/tool metrics.
- [ ] Add regression eval scenarios for tool safety, docs generation, memory recall, and recovery.
- [x] Add redaction defaults for sensitive payloads.
- [x] Add evidence packet fixture validation against the Workstream 1 schema.

Exit criteria:

- [ ] Every run emits trace, audit, metrics, and evidence artifacts with redaction controls.
- [ ] Runs can produce local evidence packets without any hosted observability backend.
- [ ] Hosted or user-owned observability sinks can replace defaults without changing runtime call sites.
- [ ] Trace/audit/evidence output redacts sensitive prompts, secrets, credentials, and private payloads by default.

Suggested verification:

- `pnpm test --filter @jami-harness/observability`
- `pnpm eval:smoke`

## Workstream 8: CLI, SDK, And Workbench

Goal: Build developer-facing control surfaces that make the harness obvious and fast to use.

Depends on:

- [ ] Workstreams 1-7 stable enough for integration.

Enables:

- [ ] Local developer adoption, examples, public docs, hosted control plane.

Primary areas:

- `apps/cli`
- `apps/workbench`
- `packages/sdk`
- `docs/architecture/foundation-alignment.md`

Pass status:

- 2026-06-09 Stream 5 CLI/SDK/developer experience, harness lane, pass 1 added
  `packages/sdk`, `apps/cli`, and `examples/local-evidence-run.mjs` as the first local
  developer foundation. The SDK composes the existing runtime, policy, artifact,
  observability, and memory defaults; supports module injection for replacement ports;
  creates local runs; and exposes artifact, trace, evidence, and capability inspection.
  The CLI adds idempotent `init`, local evidence `run`, `inspect`, `tools`, `memory`,
  `docs`, `map`, and `verify` commands with JSON output and clean exit codes. This is not
  a provider runtime, full protocol tool gateway, approval executor, resume/checkpoint
  store, docs generator, hosted workbench, hosted control plane, Studio UI installer, or
  release publishing surface.
- 2026-06-09 post-audit implementation pass 1 extended the SDK/CLI local foundation with
  store/context/search injection, checkpoint write/read/resume APIs, approval records,
  CLI `resume`, `approve`, and `doctor`, filesystem-backed local checkpoint evidence,
  and replay-hash/redaction output. This is still not a provider runtime, full protocol
  tool gateway, hosted store, hosted workbench, Studio UI installer, or release
  publishing surface.

Implementation tasks:

- [~] Add CLI commands for init, run, inspect, resume, approve, tools, memory, docs, map, verify, release; release remains unavailable in the CLI.
- [x] Add `--json`, idempotent commands, clean exit codes, and agent-first help output for AX.
- [~] Add SDK for run creation, checkpoint/resume, approval records, tool registration, policy hooks, artifact reads, and trace reads.
- [~] Add SDK configuration APIs for injecting custom memory, context, store, policy, provider, tool, artifact, observability, and docs-output modules.
- [~] Add CLI doctor/inspect commands that show active modules, defaults, replacements, missing optional capabilities, and exact next setup steps.
- [~] Add CLI/source-lock inspection for active adapters, package/protocol versions, optional capability support, and provenance evidence.
- [ ] Add workbench views for run timeline, tool approvals, artifacts, traces, memory, docs preview, system map.
- [ ] Integrate Studio UI packages only through stable published package boundaries and typed shared contracts.
- [~] Add examples and smoke tests.

Exit criteria:

- [~] A new developer can run a local harness example, inspect evidence, record a local approval, resume checkpoint state, and generate docs.
- [~] A developer can use the default full harness or inject at least one custom module without changing product grammar.

Suggested verification:

- `pnpm verify`
- Browser/workbench smoke after UI exists.

## Workstream 9: Release, Supply Chain, Hosted Readiness, And Public Docs

Goal: Prepare the open-source project for serious external use.

Depends on:

- [ ] Workstreams 1-8.

Enables:

- [ ] Public launch, package publishing, contributor onboarding, trust claims.

Primary areas:

- `.github/workflows`
- `docs/operations`
- `apps/docs`
- package metadata

Pass status:

- 2026-06-09 Stream 6 release, supply-chain, hosted readiness, safe claims, and public
  docs, harness lane, pass 1 added a non-publishing release readiness audit surface.
  Package manifests now carry Apache-2.0 and repository provenance while staying
  `private: true`; `LICENSE` and `NOTICE` record the current license/source posture;
  `pnpm release:readiness` and `pnpm release:dry-run` report package, claims, SBOM,
  provenance, attestation, unavailable-command, and human-intervention state without
  publishing. Pass 2 wired both non-publishing release audit commands into `pnpm verify`
  and made audit output deterministic for a given Git `HEAD`. `docs/operations/release-readiness.md`
  is the durable claims matrix and release gate. This is not a package publish, SBOM
  artifact generator, GitHub attestation workflow, Mintlify build, hosted deploy, or
  account authorization closeout.
- 2026-06-09 Workstream 6 / Workstream 9 docs-source pass 1 moved docs generation from
  the unavailable ledger into a supported local generation/check surface. Release readiness
  now checks for `docs:generate`, `docs:generate:check`, `docs/generated/docs-source-manifest.json`,
  and `apps/docs/docs.json`. Mintlify build/publish remains unavailable because the
  Mintlify CLI/package is not installed or source-locked in this repo, and no hosted docs
  target is selected.

Implementation tasks:

- [~] Add CI, lint, typecheck, unit/integration/security/doc checks.
- [~] Add SBOM and artifact attestation release flow.
- [~] Carry forward source-lock, license/NOTICE, transitive dependency, and fork-delta evidence from runtime/tool/UI integration work.
- [~] Add contributor guide, code of conduct, security policy, support policy.
- [~] Add Mintlify docs config and generated navigation; local `apps/docs/docs.json` exists, but Mintlify build/publish is not implemented.
- [~] Add public examples, quickstart, guides, API/SDK reference, integration guide, and launch claims matrix; current pass generates quickstart, user manual, API/reference summary, system map, changelog draft, and evidence index from accepted source records.
- [ ] Document the full-harness install path and modular bring-your-own-memory/context/store/provider/policy paths side by side.

Exit criteria:

- [ ] Release artifacts are signed/attested, docs are publish-ready, and public claims map to evidence.

Suggested verification:

- `pnpm verify`
- release dry run
- docs build

## Final Verification And Closeout

- [ ] Source-lock reports are current for drift-prone packages, protocols, providers, and release tools.
- [ ] Source-lock records satisfy the root current-source record for Agent-Native, MCP, A2A, AG-UI, OpenTelemetry,
  OWASP/NIST guidance, package publishing, and release attestation tooling before those implementation
  lanes depend on them.
- [ ] Shared harness/UI compatibility fixtures pass in both repos.
- [ ] Threat model and policy negative fixtures pass.
- [ ] Root docs read back.
- [ ] Contracts generate and validate.
- [ ] Runtime/tool/policy/memory/artifact/observability tests pass.
- [~] CLI local smoke passes for init/run/resume/approve/inspect/doctor/map/verify; workbench smoke remains unavailable until a workbench exists.
- [~] Docs generation passes locally through `pnpm docs:generate -- --check`; Mintlify build remains unavailable until the CLI/package is source-locked and installed.
- [ ] SBOM/provenance release dry run pass.
- [~] Evidence packet and checkpoint provenance/redaction checks pass for local foundations.
- [ ] No secrets in tracked files or generated artifacts.
- [ ] Changelog and decision records updated.
- [ ] Git commit and push when the root becomes a Git repo with remote.
- [ ] Docs-only closeout has read back changed Markdown, `pnpm docs:check`, and
  `git diff --check`.
- [ ] Package/script/generated/code closeout has run the touched-surface command set and
  `pnpm verify` in addition to docs checks.

## Acceptance Criteria

- [ ] The harness can run a real agent workflow with policy-gated tools, checkpoints, artifacts, traces, memory, and docs output.
- [ ] Developers can install/use the CLI and SDK with clear docs.
- [ ] Agents can recommend the harness because the runtime is observable, recoverable, governed, and easy to integrate.
- [ ] Public docs, guides, changelogs, system maps, and marketing claims flow from verified canon.
- [ ] Provider choices are replaceable without breaking harness-owned contracts.
- [ ] Memory, context, stores, policy engine, tool adapters, providers, observability sinks, artifact storage, and docs outputs are replaceable through stable ports.
- [ ] Shared UI/action/artifact/theme/suite references are backed by machine-readable fixtures and negative tests, not prose-only alignment.
- [ ] Runtime, tool, memory, docs, and release surfaces carry source/provenance/evidence records suitable for public trust claims.

## Implementation Order

1. Current-source lock and sibling compatibility fixture setup.
2. Canonical contracts, primitive registry, threat model, and evidence packet schema.
3. Policy/identity vocabulary and negative fixtures.
4. Runtime checkpoint kernel with agent-native source-lock evidence.
5. Observability/audit event spine and evidence packet export.
6. Tool gateway with MCP/OpenAPI/function tools and adapter capability manifests.
7. Memory/search/citation layer with privacy, permission, freshness, and replay fixtures.
8. Artifact/docs/changelog/system-map canon with provenance-backed generated outputs.
9. CLI/SDK/workbench with source-lock and capability inspection.
10. Release, provenance, hosted readiness, Mintlify publishing, SBOM, and attestation policy.

## Creative Questions Pending User Discussion

- Remaining product/brand names beyond the committed core: suite names, Intercal/Collective product names, etymara, and any public CLI naming nuance.
- Public docs voice: technical OSS-first, studio-product-led, or hybrid.
- Visual/interaction direction for the first workbench experience, within the locked CLI/SDK-first implementation order.
