Stream 4 pass 2 tightened artifact/evidence provenance contracts so artifact records,
artifact views, and evidence packets carry source repo, commit, ref, timestamp,
redaction state, output paths where applicable, and accepted contract names with
versions. Runtime artifact-view emission now fails closed when required provenance is
missing.

Verification: `pnpm docs:check`, `pnpm contracts:validate`,
`pnpm contracts:generate:check`, `pnpm artifacts:test`,
`pnpm observability:test`, `pnpm memory:test`, `pnpm policy:test`,
`pnpm runtime:test`, `pnpm verify`, `git diff --check`.
