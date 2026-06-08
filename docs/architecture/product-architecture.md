# Product Architecture

Date: 2026-06-07
Status: Initial production target
Owner: Jami Studio

## Architecture Thesis

Jami Agent Harness should be a contract-first agent platform with an owned semantic core,
replaceable capability modules, and replaceable infrastructure adapters. In package
terms, it is `@jami-studio/harness`, one foundation in the `@jami-studio/*` family.

The harness owns the nouns and lifecycle that make agent work reliable: run, task, plan, policy, tool, approval, artifact, memory, trace, evidence, checkpoint, decision, release, and generated-doc source. Vendors and open-source systems can accelerate execution behind stable adapter boundaries, but they should not define the product grammar.

The modular packaging rule is: core owns the grammar, modules own behavior, adapters own
vendor specifics, and users can replace modules without breaking the grammar. The durable
responsibility map is maintained in `docs/architecture/modular-responsibility-map.md`.

## Layers

1. **Core contracts** - TypeScript/Python-compatible schemas for runs, tasks, actors, tools, artifacts, memory, policies, audit events, traces, docs sources, and release packets.
2. **Runtime kernel** - Execution state machine for agent runs, tool calls, handoffs, retries, cancellation, checkpoints, streaming, and resumability.
3. **Policy and identity** - Actor model, tenant/project/environment boundaries, role/scope checks, approval prompts, policy-as-code, secret lanes, and escalation.
4. **Tool and integration gateway** - MCP clients/servers, OpenAPI tools, function tools, browser/shell/code tools, provider adapters, and tool sandboxing.
5. **Memory and context** - Project memory, task memory, artifact memory, retrieval, citations, redaction, retention, and user-controlled writes.
6. **Artifact and docs pipeline** - Reports, patches, commits, test outputs, screenshots, diagrams, changelogs, SDK references, user guides, and marketing claims generated from canon.
7. **Observability and evaluation** - OpenTelemetry-compatible traces, GenAI spans, audit logs, metrics, eval scenarios, regression results, and replay evidence.
8. **Developer surfaces** - CLI, SDKs, local workbench, hosted dashboard, docs site, examples, templates, and integration marketplace.

## Modularity Model

Harness capabilities fall into four classes:

- **Core invariants**: contracts, runtime lifecycle, policy seam, tool execution wrapper,
  artifact/evidence model, and observability event contract.
- **Included defaults**: local store, default memory, default context assembler, default
  policy engine, common provider/tool adapters, CLI, and SDK helpers.
- **Replaceable modules**: memory, context, model provider, tool adapters, policy engine,
  artifact storage, trace/audit/metric sinks, secret resolver, hosted store, docs
  publishing output, and workbench shell.
- **Optional surfaces**: hosted dashboard, docs site, advanced eval packs, marketplace
  catalogs, SaaS control plane, cloud recipes, and Studio UI Registry-powered workbench.

The full harness should be easy to install and use through `@jami-studio/harness`, while
subpackages expose stable ports for teams that bring their own infrastructure.

## Foundation Relationship

- `@jami-studio/harness` owns the governed action loop, tool invocation, memory, runtime, policy hooks, and artifact lifecycle.
- `ui-registry` / `@jami-studio/ui` owns design tokens, primitive component vocabulary, trusted runtime rendering, registry distribution, suite UI, workbench overlay, and UI install flows.
- `@jami-studio/orchestra` owns the dev-system orchestration surface over harness and UI.

The full sibling boundary is maintained in `docs/architecture/foundation-alignment.md`.
Harness-to-UI integration is contract-first: the harness emits typed `uiPayload`,
`artifactView`, `actionRef`, `themeRef`, and `suiteRef` references; Studio UI Registry
validates and renders them through resident allowlisted UI. Policy decisions, tool side
effects, memory writes, provenance, trace emission, and runtime state remain harness
responsibilities.

The harness should integrate with A2A for agent-to-agent interop and MCP for tool/data interop. The internal agent-to-UI stream can use the native SSE spine inherited from the selected foundation where it provides sequence replay and DB-sync semantics; AG-UI is the external interop adapter, not the internal renderer.

## Canon Data Flow

1. Contracts define source truth.
2. Runtime emits events, artifacts, and traces.
3. Policy gates sensitive actions before execution.
4. Evidence packets bind outputs to source inputs, tool calls, approvals, and verification.
5. Documentation generators consume accepted contracts and artifacts.
6. Public docs, changelogs, system maps, and launch claims are published from the accepted canon.

## Runtime Principles

- Every agent run has a durable id, actor, project, environment, policy mode, tool registry version, model/provider route, input snapshot, artifact directory, trace id, and audit trail.
- Tool calls are typed, permissioned, observable, cancelable, and replay-aware.
- Human approval is a product primitive, not an afterthought.
- A run can resume from checkpoint without trusting chat context.
- Failed runs preserve evidence and recommended recovery.
- Generated docs and changelogs are artifacts with provenance.

## Security Principles

- Default to least privilege and explicit consent for tool execution.
- Treat external tool descriptions, MCP server metadata, model outputs, and generated code as untrusted.
- Keep secrets in the host/provider secret store and pass only scoped references through the runtime.
- Bind HTTP tool and MCP access to audience, origin, scope, and session controls.
- Redact sensitive trace payloads by default, with controlled local debug overrides.

## Documentation Principles

- Documentation is a product surface and a control surface.
- The future Mintlify site should publish from this canon, not fork it.
- Every user-facing claim should map to a source contract, verification artifact, decision record, or accepted report.
