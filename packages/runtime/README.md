# @jami-studio/harness-runtime

Minimal harness-owned runtime spine for run lifecycle events and safe sibling-boundary
emission.

This package currently owns only:

- Typed `runEvent` emission for start, progress, completion, failure, UI payload,
  artifact view, and policy decisions.
- Data-only `uiPayload`, `actionRef`, and `artifactView` references for Studio UI
  handoff.
- Policy-gated action emission through `@jami-studio/harness-policy`.
- Failing-closed denial records for malformed, denied, replayed, poisoned, or
  secret-inline action requests.
- Runtime events that can be persisted as redacted checkpoints by the SDK or injected
  store ports.

It can write to injected event and audit sinks, including the initial
`@jami-studio/harness-observability` local evidence exporter. It does not implement the
provider runtime, hosted checkpoint store, CLI workbench, or real agent execution loop
yet.
