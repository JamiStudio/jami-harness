# Jami Harness CLI Foundation

Status: local foundation

`@jami-studio/harness-cli` provides the first agent-facing local command surface for the
existing harness packages.

Current commands:

- `jami init --json` creates `.jami-harness/harness.json` idempotently.
- `jami run --json` executes the local SDK evidence smoke and writes run evidence under
  `.jami-harness/runs/<runId>/` plus a redacted checkpoint under
  `.jami-harness/checkpoints/`.
- `jami resume --json --run-id <runId>` reports checkpoint replay status and replay hash.
- `jami approve --json --run-id <runId> --action-id <actionId>` records a local approval
  decision through the checkpoint store.
- `jami inspect --json` reports latest run evidence, checkpoint state, approvals, and
  active module capabilities.
- `jami doctor --json` reports module, checkpoint, resume, and missing optional capability
  diagnostics.
- `jami tools --json`, `jami memory --json`, `jami docs --json`, and `jami map --json`
  report current capability availability.
- `jami verify --json` checks local CLI state and core module availability with clean
  exit codes.

Malformed run and action identifiers are rejected with structured JSON errors before the
CLI reads or writes run state.

The CLI reports the tool gateway foundation as available for registry inspection,
policy-gated function execution, and unsupported adapter manifests. Local filesystem
checkpoint/resume and approval evidence are available through
`@jami-studio/harness-store-local`. Repo-level docs generation exists through
`pnpm docs:generate`; the CLI `docs` capability still reports SDK docs-output injection
as not wired. Hosted workbench, hosted stores, provider runtime, release publishing,
Mintlify build/publish, and full
MCP/OpenAPI/shell/browser/code/A2A adapters remain unavailable until those surfaces exist
with current source-lock evidence.
