Stream 4 pass 3 hardened observability defaults so trace attributes redact prompt
fields and tool metadata in addition to secret-like values before evidence export.

Verification: `pnpm docs:check`, `pnpm contracts:validate`,
`pnpm contracts:generate:check`, `pnpm artifacts:test`,
`pnpm observability:test`, `pnpm memory:test`, `pnpm policy:test`,
`pnpm runtime:test`, `pnpm verify`, `git diff --check`.
