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

It does not implement the tool gateway, provider runtime, memory/context/search,
observability sinks, durable checkpoint store, CLI, or real agent execution loop yet.
