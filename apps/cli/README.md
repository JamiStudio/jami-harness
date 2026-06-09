# Jami Harness CLI Foundation

Status: local foundation

`@jami-studio/harness-cli` provides the first agent-facing local command surface for the
existing harness packages.

Current commands:

- `jami init --json` creates `.jami-harness/harness.json` idempotently.
- `jami run --json` executes the local deterministic provider workflow through the SDK,
  policy-gated local tool gateway, evidence packet export, and checkpoint store. It
  writes run evidence under `.jami-harness/runs/<runId>/` plus a redacted checkpoint under
  `.jami-harness/checkpoints/`.
- `jami run --json --provider-id provider_openai` fails closed as an unsupported external
  provider route with a nonzero exit code; no hosted provider API is called.
- `jami run --json --provider-failure-mode fail_once` records recoverable provider failure
  evidence before deterministic retry.
- `jami resume --json --run-id <runId>` reports checkpoint replay status and replay hash.
- `jami approve --json --run-id <runId> --action-id <actionId>` records a local approval
  decision through the checkpoint store.
- `jami inspect --json` reports latest run evidence, checkpoint state, approvals, and
  active module capabilities.
- `jami doctor --json` reports module, checkpoint, resume, and missing optional capability
  diagnostics.
- `jami tools --json` reports tool adapter manifests, source-lock states, supported
  function/trusted MCP fixture paths, and fail-closed unavailable adapters.
- `jami memory --json`, `jami docs --json`, and `jami map --json` report current
  capability availability plus the full local source-checkout install path and modular
  BYO replacement paths; `jami map --json` also includes tool adapter inspection.
- `jami verify --json` checks local CLI state and core module availability with clean
  exit codes, including the generated full-local and modular replacement path manifest.

Malformed run and action identifiers are rejected with structured JSON errors before the
CLI reads or writes run state.

The CLI reports the local deterministic provider and tool gateway foundations as available
for provider replacement-port inspection, policy-gated function execution, trusted MCP
fixture execution, and unsupported adapter/provider manifests with source-lock evidence.
Local filesystem checkpoint/resume and approval evidence are available through
`@jami-studio/harness-store-local`. Repo-level docs generation exists through
`pnpm docs:generate` and is recorded in
`docs/generated/install-readiness-manifest.json`; the CLI `docs` capability still reports
SDK docs-output injection as not wired. Public package installation, hosted workbench,
hosted stores, hosted provider runtime, release publishing, Mintlify build/publish, and full
MCP/OpenAPI/shell/browser/code/provider-as-tool/A2A execution remain unavailable until
those surfaces exist with current source-lock evidence.
