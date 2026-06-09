# Modular Responsibility Map

Date: 2026-06-07
Status: Active architecture target
Owner: Jami Studio

## Purpose

Jami Harness is an owned contract core with replaceable capability modules. The
design goal is a coherent full harness for teams that want the complete system, while
still allowing advanced users to bring their own memory, context, storage, policy,
provider, tool, observability, or UI infrastructure through stable contracts.

The product posture is:

- Core owns the grammar.
- Modules own behavior.
- Adapters own vendor specifics.
- Users can replace modules without breaking the grammar.

## Capability Classes

### Core Invariants

Core invariants are required for the harness to remain a harness. They can expose
extension points, but the contract itself is not optional.

- Contracts for run, task, actor, project, environment, tool, policy, approval, artifact,
  memory reference, context source, trace, audit, evidence, checkpoint, docs source, and
  release packet.
- Runtime lifecycle for start, stream, checkpoint, resume, retry, cancel, handoff, close,
  and failure preservation.
- Policy seam for permission decisions before sensitive actions.
- Tool execution wrapper for typed inputs, timeout, cancellation, risk labels, trace,
  audit, and artifact output.
- Artifact and evidence model for generated outputs, provenance, promotion, and replay.
- Observability event contract for trace, audit, metric, and evidence emission.

### Included Defaults

Included defaults make the full harness usable immediately. They are official, supported
implementations, but they should sit behind the same ports a user can replace.

- Local durable store for development and single-user runs.
- Local artifact store.
- Default context assembler.
- Default memory module with local search/write support.
- Default policy engine using explicit roles, scopes, risk labels, approval modes, and
  secret references.
- Common provider adapters for the accepted model/tool ecosystem.
- CLI commands for init, run, inspect, resume, approve, verify, docs, map, and release.
- SDK helpers for application integration.

### Replaceable Modules

Replaceable modules are first-class packages with stable interfaces. The harness ships
defaults, but users can use their own implementation without forking the runtime.

- Memory store and retrieval.
- Context assembly and compression strategy.
- Model provider and routing.
- Tool adapters and tool registries.
- Policy engine.
- Artifact storage.
- Trace, audit, metric, and eval sinks.
- Secret reference resolver.
- Hosted store.
- Docs publishing output.
- Workbench/dashboard UI shell.

### Optional Surfaces

Optional surfaces are useful distribution or operator experiences, but not required for
all consumers.

- Hosted dashboard.
- Mintlify publishing shell.
- Advanced eval packs.
- Marketplace/provider catalogs.
- SaaS control plane.
- Organization/team admin.
- Cloud deployment recipes.
- Studio UI-powered workbench UI.

## Responsibility Matrix

| Capability | Harness Owns | Default Package Shape | Replaceable |
| --- | --- | --- | --- |
| Contracts | Canon schemas, compatibility rules, generated references | `@jami-studio/harness-contracts` | No |
| Runtime kernel | Run lifecycle, state machine, checkpointing, streaming, retry, cancel, handoff | `@jami-studio/harness-runtime` | Core stays, stores/providers swap |
| Composition | Coherent assembly of runtime, policy, tools, memory, context, artifacts, and observability | `@jami-studio/harness-core` | Partial |
| Batteries-included entry | Full default harness for normal users | `@jami-studio/harness` | Users override modules |
| Policy | Actor, scope, risk, approval, default-deny decision seam | `@jami-studio/harness-policy` | Engine replaceable |
| Tools | Registry, typed execution wrapper, timeout, cancellation, risk, audit, artifacts | `@jami-studio/harness-tools` | Adapters replaceable |
| MCP | Tool/data interop for MCP servers and clients | `@jami-studio/harness-mcp` | Optional adapter |
| OpenAPI/function tools | Tool generation and execution adapters | `@jami-studio/harness-openapi` / `@jami-studio/harness-function-tools` | Optional adapters |
| Providers | Model/provider routing behind a stable model port | `@jami-studio/harness-provider-*` | Yes |
| Memory | Memory contracts, policy-gated read/write, citations, freshness, retention, redaction | `@jami-studio/harness-memory` | Yes |
| Context | Source ranking, token budgeting, compression, citations, prompt assembly | `@jami-studio/harness-context` | Yes |
| Search | Local and hosted retrieval adapters | `@jami-studio/harness-search-*` | Yes |
| Artifacts | Artifact model, provenance, promotion, changelog/docs/system-map outputs | `@jami-studio/harness-artifacts` | Storage/renderers replaceable |
| Observability | Trace/audit/metric/evidence contract and OTel bridge | `@jami-studio/harness-observability` | Sinks replaceable |
| Storage | Durable run, artifact, memory, and trace persistence adapters | `@jami-studio/harness-store-*` | Yes |
| SDK | Developer integration API | `@jami-studio/harness-sdk` | Official surface |
| CLI | Agent-first command surface | `@jami-studio/harness-cli` | Official surface |
| Workbench | Human run/artifact/policy/trace control surface | `@jami-studio/harness-workbench` or app package | Optional |
| Evals | Regression and quality loops | `@jami-studio/harness-evals` | Optional packs |
| Docs | Generated docs/reference/site pipeline | `@jami-studio/harness-docs` | Output replaceable |

## Package Shape

The install experience should be simple:

```ts
import { createHarness } from "@jami-studio/harness";

const harness = createHarness({
  model,
  tools,
  memory,
  context,
  policy,
  store,
  observability,
});
```

The package graph should support that simple default while preserving modular use:

- `@jami-studio/harness`: batteries-included assembly for most users.
- `@jami-studio/harness-core`: composition layer and stable ports.
- `@jami-studio/harness-contracts`: schemas, type exports, JSON Schema, OpenAPI where
  appropriate.
- `@jami-studio/harness-runtime`: run lifecycle and checkpoint kernel.
- `@jami-studio/harness-policy`: policy contracts, default engine, approval modes.
- `@jami-studio/harness-tools`: tool registry and execution wrapper.
- `@jami-studio/harness-memory`: memory contracts and default module.
- `@jami-studio/harness-context`: context assembly contracts and default strategies.
- `@jami-studio/harness-artifacts`: artifact lifecycle, provenance, docs/changelog emitters.
- `@jami-studio/harness-observability`: trace, audit, metrics, OTel bridge, evidence packets.
- `@jami-studio/harness-sdk`: integration SDK.
- `@jami-studio/harness-cli`: command surface.
- `@jami-studio/harness-provider-*`: model/provider adapters.
- `@jami-studio/harness-store-*`: storage adapters.
- `@jami-studio/harness-mcp`: MCP support.
- `@jami-studio/harness-openapi`: OpenAPI tool support.

## Memory Strategy

Memory is a core contract but not a forced implementation.

Harness-owned requirements:

- Memory reads and writes are policy-gated.
- Every recalled item has source, freshness, scope, permission, and citation metadata.
- Writes declare purpose, retention, redaction class, and provenance.
- Memory can be disabled without breaking run execution.
- Memory can be replaced without changing runtime call sites.

Default modules:

- No-op memory for stateless use.
- Local development memory backed by a simple durable store.
- Postgres/vector-capable memory adapter for serious hosted deployments.
- External memory adapter for user-owned retrieval systems.

The runtime talks to memory through a stable port. It never assumes the default store is
present.

## Context Strategy

Context management is a core contract with replaceable strategy.

Harness-owned requirements:

- Context inputs record source, timestamp, freshness, permission scope, citation, token
  budget impact, and compression state.
- Context assembly is deterministic enough to replay from evidence.
- User-pinned context, system-required context, retrieved context, tool outputs, and
  artifact memory have explicit priority rules.
- Context strategies must expose why an item was included, compressed, dropped, or
  deferred.

Default modules:

- Source-ranked context assembler.
- Token budget planner.
- Compression/summarization adapter.
- Citation-preserving prompt assembly.

Replaceable strategies:

- User RAG system.
- Codebase index.
- Knowledge graph.
- External vector database.
- Manual context provider.
- Domain-specific retrieval pipeline.

Current foundation status: Stream 4 pass 1 adds a dependency-free
`@jami-studio/harness-memory` package with a no-op port, in-memory development port,
permission-filtered search, citation freshness, retention filtering, redaction defaults,
and deterministic context pack hashes. It intentionally does not add durable storage,
vector retrieval, hosted search, compression, or external RAG adapters yet.

## Policy Strategy

Policy is a core invariant. The engine behind the policy seam is replaceable.

Harness-owned requirements:

- Default-deny sensitive actions.
- Actor, project, environment, role, scope, tool risk, data sensitivity, and approval mode
  are visible to the policy decision.
- Secret values never enter model context or tracked artifacts.
- Every decision emits audit evidence.

Default module:

- Rules-based policy engine with explicit allow, deny, needs-approval, and needs-owner
  states.

Replaceable engines:

- Open Policy Agent style engine.
- Hosted enterprise policy system.
- User-provided callback.
- Static local policy file.

## Tool Strategy

Tool execution is a core invariant. Tool adapters are replaceable.

Harness-owned requirements:

- Tools declare schema, risk, side-effect class, required scopes, timeout, cancellation,
  audit fields, and artifact behavior.
- Tool calls pass through policy before execution when risk requires it.
- Tool results become typed artifacts or evidence, not untracked chat-only output.
- MCP/OpenAPI/function/shell/browser/code/provider tools all normalize through the same
  execution envelope.

Default modules:

- Function tool adapter.
- MCP client adapter.
- OpenAPI adapter.
- Local shell/browser/code adapters with policy controls.

Current foundation status: Workstream 4 pass 1 after the overclaim audit adds
`@jami-studio/harness-tools` with a replaceable in-memory registry, one policy-gated
execution envelope, a real function-tool adapter path, timeout/cancellation status,
typed trace/audit/evidence/artifact output, redaction, and unsupported capability
manifests for MCP, OpenAPI, shell, browser, code, provider, and A2A adapters. The
unsupported adapters intentionally do not claim protocol support until repo-local
source-lock evidence and adapter fixtures are added. Workstream 4 MCP source-lock pass 1
adds repo-local MCP `2025-11-25` evidence and a trusted in-process fixture adapter that
maps MCP `initialize`, `tools/list`, and `tools/call` into that same execution envelope.
The MCP manifest still marks stdio subprocess transport, remote Streamable HTTP, OAuth,
resources, prompts, roots, sampling, elicitation, tasks, resumability, and full SDK
parity as unsupported.

## Storage Strategy

Storage is replaceable behind ports.

Harness-owned requirements:

- Runs can resume from checkpoint without trusting chat context.
- Artifact/evidence ids are stable.
- Stores expose capabilities so the runtime knows whether a feature is available.
- Missing optional stores degrade explicitly rather than silently losing evidence.

Default modules:

- Local filesystem/SQLite-style development store.
- Postgres hosted store.
- External store adapter interface.

## Observability Strategy

Observability is a core event contract with replaceable sinks.

Harness-owned requirements:

- Trace, audit, metric, and evidence events are emitted for every run.
- Sensitive payload redaction is default.
- OpenTelemetry-compatible export is supported.
- Local evidence packets can be produced even when no hosted sink is configured.

Default modules:

- Local evidence packet writer.
- OTel bridge.
- Console/dev sink.

Current foundation status: Stream 4 pass 1 adds a local evidence packet exporter, event
and audit sinks for the runtime spine, minimal trace records, and artifact-backed
evidence packet artifacts. It intentionally does not add an OpenTelemetry bridge, hosted
trace backend, metrics pipeline, eval sink, CLI, or workbench view yet.

Replaceable sinks:

- Hosted tracing backend.
- SIEM/audit system.
- Custom analytics.
- Eval harness.

## Assembly Rules

- The main `@jami-studio/harness` package should feel coherent and complete.
- Subpackages should be independently useful only when that helps integration or
  replacement.
- Every optional module must advertise capabilities and failure modes.
- No optional module may weaken the core policy, audit, artifact, or evidence contracts.
- Adapters must not define product grammar. They translate vendor/provider behavior into
  harness-owned contracts.
- Defaults should be strong enough for real use, not decorative examples.

## Developer Surface Status

Current foundation status: Stream 5 pass 1 adds `@jami-studio/harness-sdk` and
`@jami-studio/harness-cli` as local developer foundations. The SDK composes current
runtime, policy, artifact, observability, and memory modules; creates a local evidence
run; reads artifacts and traces; and exposes module injection and capability inspection.
The CLI exposes idempotent local `init`, evidence `run`, `inspect`, `tools`, `memory`,
`docs`, `map`, and `verify` commands with JSON output and clean exit codes. These
surfaces intentionally report missing provider runtime, SDK-level docs-output injection,
hosted stores, hosted workbench, Studio UI install flows, and release publishing until
their owning packages exist. Workstream 6 / Workstream 9 docs-source pass 1 adds
`@jami-studio/harness-docs` as a repo-level generated docs/manual/system-map/changelog
foundation with check mode and Mintlify-ready draft output; hosted docs publishing and
Mintlify build remain unavailable.

## Workstream Implications

- Workstream 1 must define ports and capability contracts, not just data shapes.
- Workstream 2 must compose runtime against ports for store, model, memory, context,
  policy, tools, artifacts, and observability.
- Workstream 3 must keep policy engine replacement explicit.
- Workstream 4 must normalize all tool types through one execution envelope.
- Workstream 5 must split memory, context, and search into owned contracts plus
  replaceable implementations.
- Workstream 6 must treat docs/changelog/system-map outputs as artifacts with replaceable
  publishing sinks.
- Workstream 7 must separate event contracts from sink adapters.
- Workstream 8 must make the CLI/SDK default path simple while preserving explicit
  module injection.
- Workstream 9 must publish package docs that explain full-harness use and modular use
  side by side.
