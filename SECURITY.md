# Security Policy

Jami Harness is still in local foundation work. Do not treat the current packages as a
published security-supported runtime until the release readiness gate says publishable
artifacts are ready.

## Reporting

Report suspected vulnerabilities privately to the project owner through the configured
GitHub repository security channel once it is enabled. Until that channel is enabled,
record the need as a human intervention and do not publish exploit details in tracked
issues or docs.

## Secrets

Never commit API keys, tokens, credentials, signed URLs, private account material, or
runtime secret values. `.env` files are ignored and local only. Tracked examples may use
placeholder names only.

## Current Supported Surface

Current checks cover the local contract, policy, runtime, artifact, observability, memory,
CLI, SDK, and evidence-smoke foundations represented by `pnpm verify`. Provider runtime,
tool gateway, hosted stores, hosted workbench, hosted docs publishing, and release
publishing are unavailable.
