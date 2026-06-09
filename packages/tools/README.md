# Harness Tools

Status: narrow gateway foundation

This package owns the first production-shaped tool gateway surface for Jami
Harness. It provides:

- a tool registry with risk labels, scopes, timeouts, adapter ids, and capability manifests
- one execution envelope for policy, timeout/cancellation, trace, audit, evidence, artifact, and redaction output
- a real function-tool adapter path
- explicit unsupported manifests for MCP, OpenAPI, shell, browser, code, provider, and A2A adapters until repo-local source-lock evidence is refreshed for those protocols or wrappers

Denied executions do not invoke handlers. Unsupported adapters fail closed and still
produce typed trace, audit, evidence, artifact, and tool execution records. Inputs and
results are redacted before trace, evidence, and artifact output.

## Verification

Run:

```sh
pnpm tools:test
pnpm contracts:generate
pnpm contracts:validate
```

The root `pnpm verify` command includes `tools:test`.
