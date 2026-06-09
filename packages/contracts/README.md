# Harness Contracts

Status: generated machine-readable foundation

This package owns the first harness-side contract spine for the sibling
`jami-harness` and `studio-ui` boundary. It defines JSON Schema anchors and
compatibility fixtures for data the harness may emit or consume without taking
ownership of Studio UI primitives, tokens, registry packaging, or renderer
implementation.

## Owned Anchors

- `runEvent`: harness run timeline events with policy, trace, and optional UI/artifact references.
- `uiPayload`: data-only render payloads for resident Studio UI components.
- `artifactView`: harness artifact metadata and render intent.
- `actionRef`: policy-gated action handles exposed through UI slots.
- `themeRef`: references to Studio UI theme/token outputs.
- `suiteRef`: references to Studio UI suite install graphs and optional harness capabilities.
- `capabilityManifest`: harness module and adapter capability vocabulary.
- `primitiveManifest`: composable primitive registry vocabulary.
- `policyDecision`: default-deny policy decisions with actor, project, environment, scope, risk, approval, audit, evidence, and redaction references.
- `approvalRequest`: approval lifecycle records bound to actor, run, action, scopes, expiry, audit, and evidence.
- `auditEvent`: policy/approval/tool-denial audit records that preserve redaction state.
- `secretRef`: scoped secret references with redaction metadata and no serialized secret values.
- `evidencePacket`: source, command, artifact, freshness, contract, and redaction evidence for generated claims.
- `toolExecution`: policy-gated tool execution envelope with adapter status, timeout/cancellation state, trace, audit, evidence, artifact, and redaction references.
- `threatModelFixtureCatalog`: risk-to-fixture catalog for policy, tool, UI action, memory, and evidence hardening.

## Generated Artifacts

Run `pnpm --filter @jami-studio/harness-contracts generate` after changing schemas. The
generator emits checked artifacts under `generated/`:

- `contracts.ts`: schema exports and anchor metadata for TypeScript consumers.
- `openapi.json`: OpenAPI 3.1 component schemas for reference/import tooling.
- `reference.json`: compact contract reference plus the Studio UI handshake.

Run `pnpm --filter @jami-studio/harness-contracts generate:check` to fail on generated
artifact drift. The package validation gate runs the same drift check before fixture
validation, and root `pnpm verify` runs the check explicitly.

## Compatibility Fixtures

Fixtures under `fixtures/compatibility/` are intentionally small. They prove every
current shared anchor plus the contract categories that both repos need before
runtime or renderer work expands:

- unsupported UI components
- invalid payloads
- denied actions
- renderer error states
- artifact views
- theme references
- suite references
- unsafe UI prop rejection
- prompt injection denial
- tool metadata poisoning denial
- MCP transport abuse denial
- secret exfiltration denial
- cross-scope action denial
- approval replay rejection
- secret-reference value leakage rejection
- evidence packets missing command evidence
- completed, denied, unsupported, and invalid tool execution records
- threat-model fixture catalog coverage

Studio UI should add matching consumer fixtures against these schema ids in its own
lane rather than editing this package from the UI stream. The expected handshake for
Studio UI is to consume `generated/openapi.json` or `generated/contracts.ts` for schema
ids and read `generated/reference.json` for ownership notes, while keeping renderer,
token, registry packaging, and suite install behavior in the UI repo.

The validation gate fails when any anchor lacks fixture coverage, when a fixture points
outside `packages/contracts/schemas/`, or when cross-field contract semantics are
violated. Current semantic checks include denied-action evidence, elevated-risk action
confirmation, renderer error states, emitted UI payload references, policy decision
payloads, data-only UI props, Studio UI renderer component references, replacement
invariants, Studio UI registry item ids for suite refs, and Studio UI adapter
compatibility for UI-reference primitives. Required negative fixtures cover invalid
payloads, denied actions without denial evidence, renderer errors without error state,
and unsafe UI props.
Evidence packet checks reject secret-bearing packets without a redaction policy and
require unavailable commands to explain why they were unavailable. Threat-model catalog
checks require every fixture to reference a declared risk.
Tool execution checks require policy, audit, trace, evidence, artifact, and redaction
references; unsupported adapters must use the typed unsupported error state; non-completed
executions must not claim unredacted result output.
Policy checks require non-allow decisions to carry audit evidence, elevated-risk allow
decisions to carry approval references, approval requests to avoid replayable token
values, audit events to redact non-allow outcomes, and secret references to carry only
reference metadata.

## Verification

Run:

```sh
pnpm --filter @jami-studio/harness-contracts generate
pnpm --filter @jami-studio/harness-contracts generate:check
pnpm --filter @jami-studio/harness-contracts validate
```

The root `pnpm verify` command also runs generation drift checks and validation.
