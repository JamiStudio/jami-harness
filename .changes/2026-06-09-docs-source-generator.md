# Docs source generator foundation

Added a deterministic `packages/docs` generator that emits generated quickstart,
manual, API/reference, system-map, changelog, evidence-index, docs-source manifest,
and Mintlify-ready draft outputs from accepted source records. The check mode is wired
into `pnpm verify` and release readiness without claiming hosted docs or Mintlify build.
