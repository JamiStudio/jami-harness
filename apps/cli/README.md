# Jami Harness CLI Foundation

Status: local foundation

`@jami-studio/harness-cli` provides the first agent-facing local command surface for the
existing harness packages.

Current commands:

- `jami init --json` creates `.jami-harness/harness.json` idempotently.
- `jami run --json` executes the local SDK evidence smoke and writes run evidence under
  `.jami-harness/runs/<runId>/`.
- `jami inspect --json` reports latest run evidence and active module capabilities.
- `jami tools --json`, `jami memory --json`, `jami docs --json`, and `jami map --json`
  report current capability availability.
- `jami verify --json` checks local CLI state and core module availability with clean
  exit codes.

Malformed run identifiers are rejected with structured JSON errors before the CLI reads
or writes run state.

The CLI reports the tool gateway foundation as available for registry inspection,
policy-gated function execution, and unsupported adapter manifests. It still reports
docs generation, hosted workbench, hosted stores, provider runtime, release publishing,
and full MCP/OpenAPI/shell/browser/code/A2A adapters as unavailable until those
surfaces exist with current source-lock evidence.
