# Harness Contracts

Status: initial machine-readable foundation

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

## Compatibility Fixtures

Fixtures under `fixtures/compatibility/` are intentionally small. They prove the
contract categories that both repos need before runtime or renderer work expands:

- unsupported UI components
- invalid payloads
- denied actions
- renderer error states

Studio UI should add matching consumer fixtures against these schema ids in its own
lane rather than editing this package from the UI stream.

## Verification

Run:

```sh
pnpm --filter @jami-studio/harness-contracts validate
```

The root `pnpm verify` command also runs this validation.
