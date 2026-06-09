# Harness Tools

Status: narrow gateway foundation

This package owns the first production-shaped tool gateway surface for Jami
Harness. It provides:

- a tool registry with risk labels, scopes, timeouts, adapter ids, and capability manifests
- one execution envelope for policy, timeout/cancellation, trace, audit, evidence, artifact, and redaction output
- a real function-tool adapter path
- a narrow MCP `2025-11-25` adapter foundation for trusted in-process fixture discovery and
  `tools/call` mapping through the same execution envelope
- explicit unsupported manifests for OpenAPI, shell, browser, code, provider-as-tool, and A2A
  adapters until repo-local source-lock evidence is refreshed for those protocols or
  wrappers

Denied executions do not invoke handlers. Unsupported adapters fail closed and still
produce typed trace, audit, evidence, artifact, and tool execution records. Inputs and
results are redacted before trace, evidence, and artifact output.

MCP support is intentionally narrow in this pass. The supported path validates current
repo-local MCP source-lock evidence, accepts metadata only from trusted fixture servers,
maps `initialize`, `tools/list`, and `tools/call`, and rejects poisoned tool metadata
before registration. Stdio subprocess transport, remote Streamable HTTP transport, OAuth,
resources, prompts, roots, sampling, elicitation, tasks, resumability, and full SDK parity
remain unsupported and are named as unsupported in the MCP capability manifest. Model
provider routing lives in `@jami-studio/harness-provider-local`; this package does not
claim hosted provider execution.

## Verification

Run:

```sh
pnpm tools:test
pnpm contracts:generate
pnpm contracts:validate
```

The root `pnpm verify` command includes `tools:test`.
