# Jami Harness Production Feasibility Report

Date: 2026-06-07
Status: Saved for discussion
Request: Refresh the root project docs, orchestration docs, planning docs, and feasibility report for `@jami-studio/harness` as a full production-shaped product plan using current official guidance and the master rebuild corpus.
Source scope: Root workspace inventory, master rebuild docs, imported project docs, prior memory notes, and official sources checked on 2026-06-07.
Owner: Jami Studio

## Executive Summary

The project is feasible and should be planned as `@jami-studio/harness`: a contract-first, owned-core agent foundation with replaceable adapters for models, tools, sandboxes, storage, observability, docs hosting, and deployment.

The root workspace contains a substantial master research corpus plus imported project context, but no implementation packages yet. That is useful for planning because the product can start with clean ownership boundaries instead of inheriting accidental architecture.

Recommended direction: follow the master canon's foundation shape - `@jami-studio/harness`, `@jami-studio/ui`, and `@jami-studio/orchestra` - and build the harness around an owned semantic core: run lifecycle, policy, tools, memory, artifacts, observability, docs canon, and developer surfaces. Align adapters to current official standards: MCP `2025-11-25`, A2A, AG-UI, OpenAI Agents SDK patterns, OpenTelemetry GenAI semantic conventions, OWASP GenAI/agentic guidance, NIST AI RMF/Generative AI Profile, OpenAPI, GitHub/SLSA artifact attestations, and Mintlify docs publishing constraints.

The main open decisions are creative/product-positioning decisions, not system architecture blockers.

## Question Being Answered

What is the correct production-shaped plan for `@jami-studio/harness` as the open-source agent runtime foundation used across Jami Studio projects, with cohesive docs, orchestration rules, implementation planning, governance, generated documentation, and adapter-backed integrations?

## Source Scope And Method

Local sources checked:

- `Projects.md`
- `docs/research/master/00-orchestration/plan.md`
- `docs/research/master/00-orchestration/synthesis.md`
- `docs/research/master/06-rebuild-feasibility/report.md`
- `docs/research/master/08-canonical-system/report.md`
- `docs/research/master/12-agent-native/recommendation.md`
- `docs/research/master/12-agent-native/fact-finding/fact-finding-synthesis.md`
- `evals/docs/engineering/agents/goal.md`
- `evals/docs/engineering/agents/orchestration-reliability.md`
- `evals/docs/engineering/standards/planning-style.md`
- `evals/docs/engineering/standards/report-style.md`
- `evals/docs/engineering/standards/docs-standards.md`
- Root directory inventory for imported projects and Git state
- Memory notes for prior Jami Harness owned-core framing

Official/current external sources checked:

- Model Context Protocol specification, latest version `2025-11-25`
- A2A official project / Linux Foundation coverage
- AG-UI official docs
- agent-native official docs/package surface
- Microsoft Agent Governance Toolkit official docs
- OpenAI Agents SDK documentation
- OpenTelemetry GenAI semantic conventions
- OWASP Top 10 for LLM Applications 2025
- NIST AI RMF and Generative AI Profile
- OpenAPI Specification
- GitHub artifact attestations and SLSA provenance guidance
- Mintlify navigation documentation

Commands run:

- Root file inventory with `rg --files`
- Root directory capability scan for docs, agents, Git, and package metadata
- Readback of imported orchestration and standards docs
- Official-source web verification

Sources intentionally not deep-audited:

- Full `references/` corpus and the entire agent-native packed source tree. They are too large for this initial canon pass and should be queried only when a specific implementation stream needs them.
- Imported project implementation code. This report sets harness architecture; implementation streams should audit code paths when extracting reusable patterns.

## Current Project State

The workspace root contains `Projects.md` and imported project directories:

- `_legacy`
- `daily-briefs`
- `evals`
- `Modal`
- `proxies`
- `references`
- `Sherlock`
- `upscaler`
- `yrka`
- `zavi`

The root already had a master `docs/research/` corpus. It did not have root `AGENTS.md`, root `README.md`, package metadata, or Git metadata at the time of this report. Several imported project directories do have their own Git and docs, but those are project context, not root harness implementation.

Relevant master and imported guidance:

- `docs/research/master/00-orchestration/plan.md` is the operating canon: greenfield, final-shape language, official-current source verification, no self-gating, no legacy carry-forward, and no option menus for settled system decisions.
- `docs/research/master/00-orchestration/synthesis.md` maps the product family: `@jami-studio/harness`, `@jami-studio/ui`, `@jami-studio/orchestra`, Intercal, the Collective, yrka, and the dev-system posture.
- `docs/research/master/12-agent-native/recommendation.md` and its fact-finding synthesis identify agent-native as the preferred foundation source, pending current lock-time verification.
- `evals/docs/engineering/agents/goal.md` establishes a strong coordinator/subagent pattern, source-truth rules, closeout expectations, and secret hygiene.
- `evals/docs/engineering/agents/orchestration-reliability.md` establishes short-poll checkpoints and resumability.
- `evals/docs/engineering/standards/*` provides reusable plan, report, and docs standards.

Prior durable memory notes established the correct harness framing: own the product grammar and contract vocabulary, while using vendors only behind replaceable adapters for commodity infrastructure.

## Official / External Findings

MCP:

- The official Model Context Protocol latest spec is `2025-11-25`.
- MCP standardizes context/tool integration using JSON-RPC, hosts, clients, and servers.
- MCP server features include resources, prompts, and tools; client features include sampling, roots, and elicitation.
- MCP security guidance requires explicit user consent/control, data privacy controls, caution around tools as arbitrary code execution, and explicit approval for LLM sampling.
- Streamable HTTP requires origin validation, localhost binding for local servers when appropriate, authentication, session handling, protocol-version headers, and resumability considerations.
- Authorization for HTTP transports is based on OAuth-related specifications; stdio implementations should retrieve credentials from the environment rather than following the HTTP authorization spec.

A2A and AG-UI:

- Linux Foundation coverage describes A2A as a production-ready open standard for agent-to-agent interoperability with major vendor support.
- AG-UI official docs describe an event-based protocol for connecting agents to user-facing applications. It should be treated as the external interop channel, while the internal trusted render seam stays harness-owned.

agent-native and governance:

- Official agent-native docs present Dispatch as a workspace control plane for secrets, integrations, messaging, scheduled jobs, and cross-app delegation.
- Microsoft announced the Agent Governance Toolkit in April 2026 as open-source runtime governance for autonomous AI agents, with TypeScript and .NET SDKs. Use it behind a `policyCheck()` seam, not as product vocabulary.

OpenAI Agents SDK:

- Official docs describe agents as model-plus-instructions-plus-tools, with higher-level orchestration around turns, tools, guardrails, handoffs, sessions, and tracing.
- The SDK uses the Responses API by default for OpenAI models.
- Built-in tracing records LLM generations, tool calls, handoffs, guardrails, and custom events.
- This is valuable implementation guidance, but the harness should not let any one SDK own the product contract.

OpenTelemetry:

- OpenTelemetry publishes semantic conventions for generative AI systems.
- This supports a vendor-neutral observability layer rather than a proprietary-only trace format.

OWASP and NIST:

- OWASP's 2025 LLM guidance remains the practical baseline for LLM application threat modeling.
- NIST AI RMF and NIST AI 600-1 Generative AI Profile provide governance and risk-management framing suitable for enterprise trust mapping.

OpenAPI:

- OpenAPI remains the official standard contract language for HTTP APIs and should be generated from harness contracts for API/SDK docs.

Supply chain:

- GitHub artifact attestations create signed provenance claims for build artifacts and map well to open-source release trust.
- SLSA provenance should be part of release readiness, not an optional afterthought.

Mintlify:

- Mintlify `docs.json` navigation defines docs structure.
- Mintlify reserves `/api`; avoid top-level `api` folders in public docs navigation.

## Industry Standard Shape

The strongest production shape is a layered platform:

1. Stable contracts and schemas.
2. Runtime kernel with checkpoints and evidence.
3. Policy and identity layer.
4. Tool/integration gateway with explicit consent.
5. Memory/retrieval with citations and retention.
6. Artifact and docs generation pipeline.
7. Observability/audit/eval loop.
8. CLI, SDK, workbench, examples, and public docs.
9. Release provenance and supply-chain controls.

This matches modern agent platform practice: agent systems are not just model calls. They are governed workflows that use tools, mutate state, produce artifacts, expose audit surfaces, and need replayable evidence.

## Settled Implementation Shape

Build `@jami-studio/harness` as an owned-core product platform with adapter-backed infrastructure.

System shape:

- Fork/adopt the verified agent-native substrate for the action loop, workspace/control-plane patterns, A2A/MCP surfaces, and Dispatch learnings.
- Harden it behind harness-owned contracts for runs, actions, policy, memory, artifacts, traces, docs sources, and release evidence.
- Use MCP for tool/data interop, A2A for agent-to-agent interop, native SSE for internal trusted run/UI streaming where sequence replay and DB sync matter, and AG-UI as the external agent-to-UI interop adapter.
- Use a single `policyCheck()` seam for runtime governance, default-deny on error.
- Use OpenTelemetry GenAI conventions for observability and an evidence-packet export independent of any trace vendor.
- Use Mintlify later as the publishing shell, not as the source of truth.

Rejected shapes:

- A wrapper around one agent SDK: too much framework leakage.
- An MCP-only tool aggregator: insufficient for artifacts, policy, memory, governance, docs canon, and run lifecycle.
- Internal scripts only: fails the open-source product and developer-adoption goal.

## Technical Implications

Architecture:

- Use contract-first packages and generated schemas.
- Keep adapter interfaces stable and provider-specific logic replaceable.
- Add local mode and hosted mode from the same contracts.

Data model:

- First-class tables/collections for runs, tasks, actors, approvals, tools, artifacts, memory entries, audit events, traces, docs sources, and release packets.

API/MCP/contracts:

- Generate OpenAPI for HTTP APIs.
- Implement MCP clients and trusted fixture servers.
- Treat MCP metadata and tool descriptions as untrusted until policy approves.

Security:

- Origin checks, audience/scope validation, token isolation, consent prompts, redaction, sandbox limits, and policy audit are required.

Observability:

- Emit OpenTelemetry-compatible traces with GenAI span vocabulary.
- Export audit/evidence packets independent of trace backend.

Docs:

- Documentation generation must read from contracts/artifacts, not parallel prose.
- Mintlify should publish from the canonical docs tree when ready.

Deployment:

- Local-first CLI/workbench should work without hosted dependencies.
- Hosted control plane can add collaboration, teams, and persistent shared runs later in sequence without changing core contracts.

## Project Implications

- The first implementation stream should verify/fork the foundation substrate and lock contracts/primitive registry, not start with UI.
- The docs canon created in this pass should remain the root operating source.
- Imported projects should provide examples and requirements, not accidental code ownership.
- Changelogs, system maps, user guides, and launch claims must be generated or checked from accepted source artifacts.
- Orchestration should use short checkpoints so long agent cycles can resume from repo state.

## Risks And Constraints

- Root workspace currently lacks Git metadata. Commit/push closeout must wait until the root is initialized or moved into a Git repo.
- The imported context is large and can distract from harness-owned architecture. Query it only for specific evidence.
- MCP is moving. Track spec version explicitly and isolate compatibility code. The current official spec checked for this report is `2025-11-25`; any master report reference to a later spec must be reverified before implementation.
- Agent frameworks are moving. Do not let a single SDK define harness-owned contracts.
- Security controls can become performative if not enforced in runtime and tests.
- Docs generation can create stale confidence if generated artifacts are not tied to source evidence.

## Recommended Direction

Build the master-canon foundation shape: `@jami-studio/harness` on a verified agent-native substrate, hardened into an owned-core product platform with adapter-backed infrastructure.

Why:

- It matches the user's stated goal: a serious, scalable, delightful open-source product.
- It preserves the prior owned-core thesis.
- It aligns with official standards without surrendering product semantics.
- It lets Jami projects share one canon for docs, changelogs, system maps, user guides, release evidence, and public claims.
- It supports both developers and agents: typed contracts for machines, readable evidence for humans.

## Decision Points

### Product Naming And Public Brand

Options:

- Option A: Keep committed core: `jami` agent, `the Studio` environment, `jami.studio` platform, `@jami-studio/harness` package.
- Option B: Adjust remaining public product/suite/CLI names in a naming sweep.

Tradeoffs:

- Option A: Keeps system work unblocked and matches master canon.
- Option B: Gives creative polish where the canon intentionally leaves room.

Recommendation: Option A for this repo; schedule Option B for remaining names only.

Why: The package identity and core naming are already committed in the master canon; the remaining naming work is creative.

Implication if different: Rename public docs/nav/package names before launch and keep internal contract namespaces stable.

### Public Docs Voice

Options:

- Option A: Technical OSS-first.
- Option B: Product-led studio platform.
- Option C: Hybrid developer-product voice.

Tradeoffs:

- Option A: Strong for GitHub adoption; may understate vision.
- Option B: Strong for positioning; may feel less credible to OSS contributors.
- Option C: Best balance; needs careful editorial discipline.

Recommendation: Option C.

Why: The product needs developer trust and a memorable product story.

Implication if different: Mintlify IA and examples should shift toward chosen audience.

## Decision Questions For Discussion

1. Are we keeping the committed package/product identity exactly as `@jami-studio/harness`, with the remaining naming sweep limited to suite/product/CLI polish?
2. Should public docs sound OSS-technical, product-led, or hybrid?
3. What should the first workbench experience feel like visually: IDE-like, operations-console-like, or Studio-native?

## Next Step If Accepted

1. Accept or adjust the decision points above.
2. Promote accepted decisions into `docs/decisions/`.
3. Initialize implementation package structure from the active roadmap.
4. Start Workstream 1: contracts and primitive registry.
5. Keep docs generation, changelog, system map, and public-claim source manifests in the first implementation pass, not after the fact.

## Sources

Local:

- `Projects.md`
- `README.md`
- `AGENTS.md`
- `docs/README.md`
- `docs/project/charter.md`
- `docs/engineering/agents/goal.md`
- `docs/engineering/agents/orchestration-reliability.md`
- `docs/engineering/standards/planning-style.md`
- `docs/engineering/standards/report-style.md`
- `docs/engineering/standards/docs-standards.md`
- `docs/architecture/product-architecture.md`
- `docs/architecture/candidate-stack.md`
- `docs/owned-core/README.md`
- `docs/roadmaps/2026-06-07-jami-harness-production-plan.md`
- `docs/research/master/00-orchestration/plan.md`
- `docs/research/master/00-orchestration/synthesis.md`
- `docs/research/master/06-rebuild-feasibility/report.md`
- `docs/research/master/08-canonical-system/report.md`
- `docs/research/master/12-agent-native/recommendation.md`
- `docs/research/master/12-agent-native/fact-finding/fact-finding-synthesis.md`
- `evals/docs/engineering/agents/goal.md`
- `evals/docs/engineering/agents/orchestration-reliability.md`
- `evals/docs/engineering/standards/planning-style.md`
- `evals/docs/engineering/standards/report-style.md`
- `evals/docs/engineering/standards/docs-standards.md`

Official:

- https://modelcontextprotocol.io/specification/2025-11-25
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation
- https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year
- https://docs.ag-ui.com/
- https://www.agent-native.com/docs/dispatch
- https://opensource.microsoft.com/blog/2026/04/02/introducing-the-agent-governance-toolkit-open-source-runtime-security-for-ai-agents/
- https://openai.github.io/openai-agents-python/
- https://openai.github.io/openai-agents-python/agents/
- https://openai.github.io/openai-agents-python/tools/
- https://openai.github.io/openai-agents-python/handoffs/
- https://openai.github.io/openai-agents-python/tracing/
- https://opentelemetry.io/docs/specs/semconv/gen-ai/
- https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/
- https://www.nist.gov/itl/ai-risk-management-framework
- https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf
- https://spec.openapis.org/oas/
- https://docs.github.com/actions/concepts/security/artifact-attestations
- https://slsa.dev/get-started
- https://mintlify.com/docs/navigation
