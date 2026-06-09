# Owned Core

Date: 2026-06-07
Status: Initial taxonomy
Owner: Jami Studio

The owned core is the product grammar Jami Harness must control directly. Infrastructure can be adapter-backed; these semantics cannot be outsourced without weakening the product.

## Mechanism Areas

- **Agent runtime** - runs, sessions, tasks, turns, handoffs, retries, cancellation, checkpoints, resumability.
- **Artifact contracts** - file changes, commits, reports, docs, screenshots, eval outputs, release packets, provenance metadata.
- **Tool and integration policy** - tool registry, MCP/OpenAPI/function tools, approval modes, scopes, risk labels, execution limits.
- **Memory and context** - project memory, task memory, artifact memory, citations, redaction, retention, write policy.
- **Workflow execution** - workstreams, dispatches, passes, coordinator checkpoints, verification, closeout.
- **Identity and governance** - actors, tenants, projects, environments, roles, policies, approvals, secret references.
- **Observability and audit** - traces, spans, audit events, metrics, evidence packets, incident exports.
- **Search and retrieval** - indexing contracts, source attribution, freshness metadata, permission-filtered retrieval.
- **Sandbox and code execution** - workspace boundaries, filesystem policy, network policy, process lifecycle, artifact promotion.
- **Workspace UI and developer experience** - CLI, SDK, dashboard, docs previews, system maps, generated guides.
- **Canon publishing** - changelogs, docs, user guides, marketing claims, release notes, and Mintlify-ready navigation.
- **AX agent discoverability** - `llms.txt`, MCP server, OpenAPI, typed SDKs, machine-readable capability manifests, JSON CLI output, and scaffolded `AGENTS.md`.

## Primitive Registry

Use the term `composable primitive registry` for the harness-owned catalog of run primitives, tool primitives, policy primitives, artifact primitives, memory primitives, and docs primitives.

Each primitive should define:

- id and version
- owner package
- input and output schema
- policy requirements
- audit event shape
- trace span shape
- docs generation metadata
- verification requirements
- adapter compatibility

The initial machine-readable vocabulary is in
`packages/contracts/schemas/primitive-manifest.schema.json`. Capability modules and
adapters use `packages/contracts/schemas/capability-manifest.schema.json` to declare
supported features, unsupported states, required scopes, failure modes, and replacement
compatibility. These manifests keep optional modules replaceable while preserving policy,
audit, artifact, evidence, redaction, and checkpoint invariants.

## Product Rule

If a concept appears in user trust, agent autonomy, artifact promotion, public documentation, or governance claims, it belongs in the owned core first and behind an adapter second.

The master canon term for this posture is Principled Edge: root-correct, zero-bloat, final-shape systems that stand on leading open tooling without surrendering the product vocabulary.
