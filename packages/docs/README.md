# Harness Docs Generator

`@jami-studio/harness-docs` turns accepted source records into generated docs
artifacts. It is a local generation foundation, not a hosted docs publisher.

Current inputs:

- package manifests
- contract schemas and generated contract references
- accepted compatibility, policy, tool, artifact, memory, and observability fixtures
- changelog fragments under `.changes/`
- release readiness policy
- CLI and SDK docs

Current outputs:

- quickstart and user manual
- API/reference summary
- system map
- changelog draft
- claims/manual evidence index
- install-readiness manifest for the full local source-checkout path and modular BYO paths
- docs-source manifest
- Mintlify-ready `apps/docs/docs.json` and MDX page draft

Run:

```powershell
pnpm docs:generate
pnpm docs:generate -- --check
```

The generator is deterministic for the current source tree. Generated provenance uses
the symbolic source commit `git:HEAD` plus an input hash so check mode does not drift
after committing generated outputs.
