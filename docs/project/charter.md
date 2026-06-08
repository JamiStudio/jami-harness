# Project Charter

Date: 2026-06-07
Status: Active canon
Owner: Jami Studio

## Mission

Jami Agent Harness is `@jami-studio/harness`: the provider-agnostic agent SDK and governed action runtime for the `jami.studio` foundations. It lets developers and agents build, run, govern, inspect, document, and improve real software work across Jami Studio projects and open-source consumers.

The product target is a robust, production-ready agent harness that developers enjoy using because it gives them power without chaos: clear contracts, safe tool access, portable runtime adapters, durable artifacts, readable traces, strong policy controls, and documentation that stays synchronized with the system.

## Product Promise

The harness should make agentic development feel reliable:

- Agents know what they can do, what they changed, what evidence they produced, and when they need human approval.
- Developers can inspect every run, replay or resume important work, compare outputs, and trust the artifact trail.
- Product teams get changelogs, docs updates, system maps, user guides, and marketing-ready claims from one canonical source.
- Integrations are powerful but replaceable. Product semantics remain owned by the harness.

## Non-Negotiables

- Production-shaped planning only. No intentionally throwaway product shape.
- One canon source for product contracts, docs, changelogs, system maps, user guides, and launch claims.
- Provider and tool adapters remain behind harness-owned contracts.
- Policy, identity, approval, audit, and artifact boundaries are first-class.
- External claims must link to current official sources.
- Secrets stay in local or hosted secret stores, never in tracked docs or generated artifacts.
- Imported product context informs the design, but the harness must be coherent as its own open-source product.

## Master Canon Alignment

The master rebuild canon under `docs/research/master/` is the source context for this project. The accepted direction is greenfield product work under the `C:\Users\james\dev` structure, with `oss/registry` housing the foundation repos:

- `@jami-studio/harness` - provider-agnostic agent runtime and governed action loop.
- `@jami-studio/ui` - tokenized UI Registry and primitive render vocabulary.
- `@jami-studio/orchestra` - orchestration/dev system over harness and UI.

The harness should fork the MIT `agent-native` foundation where that remains the verified current best starting point, then own the durable vocabulary and harden the adapter seams. The fork is not legacy carry-forward; it is an adopted open-source foundation.

## Imported Context

This workspace includes context from active and legacy Jami projects:

- `zavi` - realtime voice agent, Hermes harness, sub-agent orchestration, desktop/runtime UX.
- `evals` - local eval harness, model result pipeline, orchestration discipline, standards docs.
- `Modal` and `upscaler` - model/runtime operations, asset lifecycle, cloud/local execution surfaces.
- `yrka` - production SaaS documentation, provider operations, manual/docs generation, AI assistant surfaces.
- `daily-briefs` - dispatch-only orchestration and scheduled content workflows.
- `proxies` - local model/provider proxy experience and OpenAI-compatible routing.
- `docs/research/master` - master rebuild reports, foundation decisions, operating canon, and product-family synthesis.
- `references` and `_legacy` - research and comparative implementation corpus.

## Ownership Thesis

Harness-owned:

- Agent run lifecycle and state machine.
- Artifact contracts and promotion rules.
- Tool registry, permission model, approval semantics, and policy hooks.
- Memory/context taxonomy and recall/write policy.
- Workflow checkpoints, resumability, and handoff contracts.
- Identity, actor, tenant, project, environment, and secret vocabulary.
- Audit event schema, trace model, eval hooks, and evidence packets.
- Docs/changelog/system-map source generation rules.
- Developer CLI, SDK, local workbench, and hosted control plane semantics.

Adapter-backed:

- Model providers and model routing.
- MCP servers and external tools.
- Databases, object storage, queues, search engines, sandboxes, billing, email, analytics, and telemetry sinks.
- Documentation hosting, deployment platforms, package registries, and CI systems.
