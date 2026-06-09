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

## Source Findings

- [x] The root workspace currently has imported project context but no prior root `docs/` canon.
- [x] Imported `evals` docs provide reusable orchestration, planning, docs, and report standards.
- [x] Prior harness framing established the owned-core thesis: own product grammar and contracts; put vendors behind adapters.
- [x] `docs/architecture/modular-responsibility-map.md` establishes the packaging thesis: core owns grammar, modules own behavior, adapters own vendor specifics, and users can replace modules without breaking harness contracts.
- [x] The registry-root source-lock record dated 2026-06-09 selects MCP baseline `2025-06-18`
  for implementation intake; Streamable HTTP, authorization, tool safety, elicitation,
  sampling, roots, consent, origin validation, and local-binding safeguards are directly
  relevant. Re-check the registry-root record before any MCP implementation work because
  protocol currentness is drift-prone.
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
- Root verification now runs `pnpm contracts:validate` through `pnpm verify`.
- The workstream remains open because broad run/task/policy/memory/evidence schemas,
  core ports, primitive lifecycle/versioning docs, and cross-repo Studio UI consumer
  fixtures are not implemented yet.

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

Depends on:

- [ ] Workstream 1 contracts.

Enables:

- [ ] Tool gateway, workflow execution, CLI run control, observability.

Primary areas:

- `packages/runtime`
- `packages/core`
- `packages/artifacts`

Implementation tasks:

- [ ] Implement run/session/task state machine.
- [ ] Produce a source-lock report for agent-native before adoption or fork work: exact scoped package names, current versions, dist-tags, repository commit or tarball evidence, license/NOTICE files, transitive dependency review, and fork-delta rationale.
- [ ] Preserve upstream MIT notices and add Apache-2.0 foundation licensing as accepted.
- [ ] Add turn streaming, cancellation, retry, timeout, handoff, and checkpoint semantics.
- [ ] Add local durable store adapter and hosted-store interface.
- [ ] Compose runtime against replaceable model, store, memory, context, policy, tool, artifact, observability, and secret-resolver ports.
- [ ] Add explicit capability checks for optional modules so absent memory/context/search/docs sinks degrade clearly.
- [ ] Add recovery from checkpoint with evidence preservation.
- [ ] Add runtime contract tests and simulated failure recovery tests.

Exit criteria:

- [ ] A run can start, execute mock turns/tools, checkpoint, fail, resume, and close with artifacts.
- [ ] Runtime call sites do not assume any default memory, context, store, provider, or observability implementation.
- [ ] No public harness contract imports agent-native package types directly.
- [ ] Runtime checkpoint/resume evidence survives retry, cancellation, and failure recovery fixtures.

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

Implementation tasks:

- [ ] Implement tool registry and risk labels.
- [ ] Normalize MCP, OpenAPI, function, shell, browser, code, and provider tools through one execution envelope.
- [ ] Add MCP client support for stdio and Streamable HTTP.
- [ ] Add A2A agent-card/task interop where cross-agent communication is required.
- [ ] Add origin/session/auth controls for HTTP transports, including MCP Streamable HTTP origin and localhost-binding safeguards where applicable.
- [ ] Add OpenAPI/function tool adapters.
- [ ] Add local shell/browser/code wrappers with sandbox policy.
- [ ] Add tool-call approval, timeout, cancellation, trace, and audit events.
- [ ] Add adapter capability manifests for streaming, cancellation, resumability, auth model, tool result shape, artifact support, error taxonomy, trace propagation, policy hooks, and unsupported states.

Exit criteria:

- [ ] Tools execute only through policy, emit traces/audit, and produce typed artifacts.
- [ ] Every adapter has positive, denied, unsupported, and trace/evidence fixtures.

Suggested verification:

- `pnpm test --filter @jami-harness/tools`
- MCP compatibility smoke against trusted local fixture server.

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

Implementation tasks:

- [ ] Define project/task/artifact memory taxonomy.
- [ ] Define context source taxonomy for pinned, system-required, retrieved, compressed, tool-output, artifact, and user-provided context.
- [ ] Add write policy, retention, redaction, and source attribution.
- [ ] Add no-op memory and no-op search adapters for stateless users.
- [ ] Add local default memory/search modules for development.
- [ ] Add external memory/search adapter interfaces for user-owned RAG, vector database, graph, or retrieval systems.
- [ ] Add context assembly strategy interface with token budget, freshness, permission, priority, inclusion/exclusion reason, and citation metadata.
- [ ] Add retrieval adapters for local and hosted search.
- [ ] Add citation and freshness metadata to every recalled item.
- [ ] Add eval fixtures for recall precision and permission filtering.
- [ ] Add privacy and replay fixtures for data classes, retention, forgetting/redaction, permission leakage, inclusion reasons, and deterministic context pack hashes.

Exit criteria:

- [ ] Memory reads and writes are policy-gated, cited, redactable, and replayable.
- [ ] Runs can execute with no memory module configured.
- [ ] Context assembly is replaceable and replayable from evidence.
- [ ] User-owned memory/search/context systems can integrate without changing runtime call sites.
- [ ] Cross-project or cross-actor memory leakage attempts fail closed.

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

Implementation tasks:

- [ ] Define artifact promotion states and provenance metadata.
- [ ] Define artifact storage port and default local storage module.
- [ ] Generate changelog entries, user guide deltas, system maps, and API references from accepted artifacts.
- [ ] Keep docs/changelog/system-map publishing outputs replaceable while preserving provenance.
- [ ] Add docs-source manifests and verification gates.
- [ ] Add Mintlify-ready navigation generation.
- [ ] Add claim registry for marketing and public docs.
- [ ] Require generated docs/changelog/system-map outputs to include source commit, accepted contract, command result, timestamp, freshness class, and generated output paths.

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

Implementation tasks:

- [ ] Implement OpenTelemetry-compatible traces with GenAI span vocabulary.
- [ ] Add audit event stream and evidence-packet export.
- [ ] Separate trace/audit/metric/evidence event contracts from sink adapters.
- [ ] Add local evidence packet sink and OTel bridge as defaults.
- [ ] Add cost/latency/token/tool metrics.
- [ ] Add regression eval scenarios for tool safety, docs generation, memory recall, and recovery.
- [ ] Add redaction defaults for sensitive payloads.
- [ ] Add evidence packet fixture validation against the Workstream 1 schema.

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

Implementation tasks:

- [ ] Add CLI commands for init, run, inspect, resume, approve, tools, memory, docs, map, verify, release.
- [ ] Add `--json`, idempotent commands, clean exit codes, and agent-first help output for AX.
- [ ] Add SDK for run creation, tool registration, policy hooks, artifact reads, and trace reads.
- [ ] Add SDK configuration APIs for injecting custom memory, context, store, policy, provider, tool, artifact, observability, and docs-output modules.
- [ ] Add CLI doctor/inspect commands that show active modules, defaults, replacements, missing optional capabilities, and exact next setup steps.
- [ ] Add CLI/source-lock inspection for active adapters, package/protocol versions, optional capability support, and provenance evidence.
- [ ] Add workbench views for run timeline, tool approvals, artifacts, traces, memory, docs preview, system map.
- [ ] Integrate Studio UI packages only through stable published package boundaries and typed shared contracts.
- [ ] Add examples and smoke tests.

Exit criteria:

- [ ] A new developer can run a local harness example, inspect evidence, approve a tool, and generate docs.
- [ ] A developer can use the default full harness or inject at least one custom module without changing product grammar.

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

Implementation tasks:

- [ ] Add CI, lint, typecheck, unit/integration/security/doc checks.
- [ ] Add SBOM and artifact attestation release flow.
- [ ] Carry forward source-lock, license/NOTICE, transitive dependency, and fork-delta evidence from runtime/tool/UI integration work.
- [ ] Add contributor guide, code of conduct, security policy, support policy.
- [ ] Add Mintlify docs config and generated navigation.
- [ ] Add public examples, quickstart, guides, API/SDK reference, integration guide, and launch claims matrix.
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
- [ ] CLI and workbench smoke pass.
- [ ] Docs generation and Mintlify build pass.
- [ ] SBOM/provenance release dry run pass.
- [ ] Evidence packet provenance and redaction checks pass.
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
