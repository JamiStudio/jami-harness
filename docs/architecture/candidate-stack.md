# Candidate Stack

Date: 2026-06-07
Status: Initial recommendation
Owner: Jami Studio

## Recommendation Summary

Use a TypeScript-first monorepo for product contracts, SDKs, UI integration, docs generation, and adapters; use Python where the OpenAI Agents SDK, evaluation tooling, or data tooling is materially stronger. Keep the runtime contracts language-neutral and expose them through JSON Schema/OpenAPI/MCP/A2A-compatible surfaces.

The master canon points to a wholesale fork of the MIT `agent-native` foundation as the starting substrate, with targeted swaps and hardening. Treat that as the preferred implementation base if current package/license verification still confirms the same facts at lock time.

## Core Choices

| Area | Recommended default | Why |
| --- | --- | --- |
| Monorepo | pnpm + Turborepo-style package graph | Familiar across imported projects, good package boundaries, fast local dev. |
| Primary language | TypeScript | Best fit for SDKs, CLIs, web UI, JSON Schema, docs generation, adapter manifests. |
| Agent runtime bridge | TypeScript kernel plus Python adapters where useful | Keeps product contracts owned while allowing OpenAI Agents SDK and Python eval tools. |
| Contracts | Zod/JSON Schema plus generated OpenAPI | Strong developer ergonomics and machine-readable docs/API surfaces. |
| Agent foundation | agent-native fork, hardened behind owned contracts | Biggest verified head start for action loop, Dispatch patterns, workspace resources, A2A/MCP surfaces, and control plane. |
| Tool protocol | MCP latest spec plus OpenAPI/function tools | MCP is the current open integration protocol for tools/resources/prompts; OpenAPI remains essential for HTTP APIs. |
| Agent-to-agent | A2A | Official Linux Foundation project with broad cloud/vendor adoption; use as interop, not as product grammar. |
| Agent-to-UI | Native SSE internally, AG-UI externally | Internal stream needs sequence replay and state sync; AG-UI provides open external interop. |
| Observability | OpenTelemetry with GenAI semantic conventions | Vendor-neutral traces and metrics with AI-specific span conventions. |
| Policy | `policyCheck()` seam over Microsoft Agent Governance Toolkit or equivalent | Runtime governance is required; keep a single default-deny seam so preview or vendor churn is replaceable. |
| Storage | Postgres for control plane, object storage for artifacts, SQLite/local files for local mode | Production durability plus simple local development. |
| Queue/workers | Adapter-backed jobs with durable run checkpoints | Runtime can move between local workers and hosted queues. |
| Docs | Markdown/MDX canon, Mintlify publishing later | Keeps source portable and publish-ready. |
| Supply chain | GitHub Actions provenance/attestations, SBOM, signed releases | Fits open-source distribution and verifiable release claims. |
| License | Apache-2.0 for the open foundation, preserving upstream MIT notices | Keeps OSS funding eligibility and adds patent/trademark clarity. |

## External Standards To Track

- MCP specification baseline selected by
  `C:\Users\james\dev\orgs\oss\registry\docs\operations\source-lock-evidence.md`;
  the current registry-root source-lock record dated 2026-06-09 selects `2025-06-18`
  for implementation intake. Re-check the registry-root record and add repo-local
  command-backed source-lock evidence before any MCP implementation depends on it.
- A2A official project/docs for agent-to-agent interop.
- AG-UI official docs for external agent-to-UI event interop.
- agent-native official docs/package metadata for fork feasibility and exact package versions.
- Microsoft Agent Governance Toolkit official docs/package metadata for runtime governance feasibility.
- OpenAI Agents SDK official docs for agent orchestration patterns, tools, guardrails, handoffs, sessions, and tracing.
- OpenTelemetry GenAI semantic conventions for trace and metric vocabulary.
- OWASP LLM and agentic AI guidance for threat modeling.
- NIST AI RMF and Generative AI Profile for governance mapping.
- OpenAPI Specification for HTTP contract publishing.
- SLSA/GitHub artifact attestation guidance for release provenance.
- Mintlify docs for `docs.json` navigation and publishing constraints.

## Vendor Boundary

Vendors may provide:

- Model inference and hosted tools.
- OAuth and account connectors.
- Sandboxes and browser execution.
- Databases, storage, queues, tracing backends, search, billing, deployment, docs hosting.

Vendors must not own:

- Run state vocabulary.
- Artifact promotion rules.
- Approval semantics.
- Memory taxonomy.
- Audit event schema.
- Docs/changelog source canon.
- Tool risk model.
