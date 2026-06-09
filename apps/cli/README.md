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

The CLI intentionally reports tool gateway, docs generation, hosted workbench, hosted
stores, provider runtime, and release publishing as unavailable until those packages exist.
