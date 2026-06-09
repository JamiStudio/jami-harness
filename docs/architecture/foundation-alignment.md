# Foundation Alignment

Status: Active boundary
Owner: Jami.Studio
Last updated: 2026-06-09

## Purpose

Jami Harness and Studio UI are sibling foundation projects. They stay
separate so each can publish, version, and integrate independently, but they share a
deliberate contract surface under the `@jami-studio/*` family.

## Sibling Repositories

- `jami-harness`: source at `C:\Users\james\dev\orgs\oss\registry\jami-harness`.
- `studio-ui`: source at `C:\Users\james\dev\orgs\oss\registry\studio-ui`.

The repositories should remain separate until a later decision record proves that one
workspace would reduce real release or integration friction. Planning convenience is not
enough reason to merge them.

## Responsibility Split

Jami Harness owns:

- Agent run, task, session, plan, handoff, retry, cancellation, and checkpoint contracts.
- Tool, MCP, OpenAPI, function-tool, shell/browser/code, and provider adapter execution.
- Policy, approval, actor, scope, identity, secret-reference, and audit decisions.
- Memory, citation, context, evidence, trace, metric, and artifact lifecycle.
- Agent-facing CLI, SDK, run inspection, docs generation, and release evidence flows.

Studio UI owns:

- Tokens, factory themes, and generated design-system outputs.
- Radix-first shadcn primitives, components, blocks, pages, app shells, and suites.
- shadcn-compatible registry items and install-time package metadata.
- Resident runtime renderer vocabulary, payload validation, and UI fallback behavior.
- Always-live workbench overlay, theme/preset save flows, package registration, and
  registry export.
- CLI install/config flows for UI items, themes, pages, apps, and suites.

## Shared Contracts

The shared seam is typed data, not arbitrary code:

- Harness emits structured artifact, action, state, and UI payload references.
- Studio UI validates and renders those payloads with resident allowlisted components.
- Harness action refs stay policy-gated and auditable.
- Studio UI components expose declared action slots and never execute model-provided code.
- Theme, preset, registry item, and suite metadata can be referenced by harness artifacts
  but remain authored and distributed by Studio UI.

Initial shared contract families:

- `uiPayload`: component name, props, children, action refs, vocabulary generation, and
  fallback metadata.
- `artifactView`: artifact id, kind, provenance, promoted state, available renderers, and
  source evidence references.
- `actionRef`: stable id, label, risk, policy scope, confirmation mode, and harness route.
- `themeRef`: theme id, token version, source registry item, factory/custom status, and
  restore target.
- `suiteRef`: suite lane, installed item graph, app shell id, route map, and optional
  harness capabilities.

Harness-side schema anchors now live in
`packages/contracts/schemas/` with compatibility fixtures under
`packages/contracts/fixtures/`. These anchors define the data the harness can emit or
consume at the sibling seam; they do not define Studio UI token output, primitive
implementation, registry item packaging, resident renderer internals, or suite install
behavior.

The initial checkable anchors are:

- `runEvent`
- `uiPayload`
- `artifactView`
- `actionRef`
- `themeRef`
- `suiteRef`
- `capabilityManifest`
- `primitiveManifest`
- `policyDecision`
- `approvalRequest`
- `auditEvent`
- `secretRef`
- `evidencePacket`
- `threatModelFixtureCatalog`

The first compatibility cases cover unsupported UI components, invalid payloads,
denied actions, renderer error states, artifact views, theme references, suite
references, and unsafe UI prop rejection. Harness validation now requires fixture
coverage for every current shared anchor and fails cross-field semantics such as denied
actions without policy evidence or renderer errors without a typed renderer error state.
It also rejects unsafe UI props and suite refs that do not point at Studio UI registry
items. Policy fixtures now cover prompt injection, tool metadata poisoning, MCP transport
abuse, secret exfiltration, approval replay, denied action audit states, and
secret-reference value leakage as harness-owned typed references. The contracts package now emits checked generated artifacts in
`packages/contracts/generated/`: TypeScript schema exports, an OpenAPI 3.1 component
reference, and a compact reference manifest with the Studio UI handshake. Studio UI
should consume those generated outputs or the same schema ids and fixture categories
from its own lane and report any renderer-side fixture needs back across the sibling
boundary.

## Integration Direction

The first integration should be contract-first:

1. Studio UI defines renderer payload schema and component vocabulary.
2. Harness defines artifact/action/policy references that can point at UI payloads.
3. Both repos add machine-readable compatibility fixtures for shared payloads, action
   responses, artifact views, theme refs, suite refs, unsupported components, denied
   actions, invalid payloads, and renderer error states.
4. Suite packs consume harness capabilities through adapters, not direct runtime imports.
5. Showcase or hosted apps can import both packages through normal package boundaries once
   each side has stable exports.

## Non-Goals

- Do not merge the repos only because planning happens in parallel.
- Do not let the harness own UI primitives, token decisions, or registry packaging.
- Do not let the UI registry own policy execution, tool invocation, memory writes, or
  agent runtime state.
- Do not render arbitrary model-provided React, HTML, scripts, or package imports.
- Do not accept shared harness/UI contracts as prose-only alignment; every active seam
  needs schemas or fixtures and failing-closed negative cases.
- Do not duplicate full roadmaps across repos; link them and keep project-specific
  execution in the owning repo.

## Cross-Links

- Harness roadmap: `docs/roadmaps/2026-06-07-jami-harness-production-plan.md`
- Studio UI roadmap: `C:\Users\james\dev\orgs\oss\registry\studio-ui\docs\roadmaps\2026-06-07-studio-ui-production-shape-plan.md`
- Harness product architecture: `docs/architecture/product-architecture.md`
- Studio UI product shape: `C:\Users\james\dev\orgs\oss\registry\studio-ui\docs\architecture\studio-ui-product-shape.md`
