# Harness Policy

Status: initial runtime spine

This package owns the first default-deny policy runtime for harness-controlled actions.
It does not own Studio UI rendering and does not execute tools. It evaluates structured
action requests, actor scopes, approval bindings, transport safety signals, and secret
reference usage, then returns a typed decision plus audit evidence.

The exported policy engine port is intentionally small:

- `evaluate(request)`: returns `allow`, `deny`, `needs_approval`, or `needs_owner`.
- `createDefaultPolicyEngine(options)`: rules-based default engine.
- `createPolicyGatedRunKernel(options)`: minimal runtime helper that gates a proposed
  run action before a later tool/runtime package executes it.

The default engine fails closed for missing scopes, prompt injection signals, tool
metadata poisoning, unsafe MCP transport controls, secret value leakage, approval replay,
approval expiry, and actor/action/scope mismatches.

Run:

```sh
pnpm --filter @jami-studio/harness-policy test
```
