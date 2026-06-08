# Documentation Standards

Durable docs should make Jami Harness easier to build, operate, publish, and hand off without becoming a second implementation surface. The live contracts and source artifacts remain authoritative.

## Ownership

- Harness contracts, schemas, source packages, policy definitions, adapter manifests, generated artifacts, and verification scripts own executable truth.
- Architecture docs explain ownership, data flow, and execution paths.
- Operations docs explain how to run and support the harness safely.
- Integration docs explain provider adapters, MCP servers, OpenAPI tools, model routing, hosted sandboxes, local sandboxes, and secret lanes.
- Research/feasibility docs are dated source reports, not operating policy.
- Roadmaps hold active execution steps and retire after durable docs carry lasting rules.

## Canon Pipeline

One canon source should feed:

- Public docs and Mintlify navigation.
- Changelog and release notes.
- System maps and architecture diagrams.
- SDK/API references.
- User guides and quickstarts.
- Marketing pages and launch claims.
- Support runbooks and incident playbooks.
- Eval scenarios and regression assertions.

Generated content must include enough metadata to identify its source contract, generation time, generator version, and verification state.

When implementation packages exist, keep docs, marketing, legal/support material, user manuals,
architecture diagrams, system maps, changelogs, and release notes generated from accepted contracts,
manifests, fragments, and evidence packets rather than copied by hand.

## Link Policy

- Prefer links to stable directories and source-owned files.
- Avoid links from durable docs to dated roadmap files unless describing history.
- Do not add subdirectory README files unless the directory owns a stable index or executable truth.
- For Mintlify, keep page paths compatible with `docs.json`; avoid top-level `api` as a folder name because Mintlify reserves that route.

## Drift Controls

- Do not duplicate volatile provider lists, model rosters, limits, pricing, protocol versions, or benchmark tables in durable docs when source data can own them.
- Verify drift-prone external facts against official provider or standards sources before changing them.
- Do not promote a provider, model, framework, or protocol claim to stable without recorded evidence or official-source citation.
- Public claims must be backed by accepted source records or verified artifacts.

## Security

- Never write secrets into docs, fixtures, screenshots, metadata, generated output, traces, logs, or examples.
- Redact account identifiers unless needed for local operator setup and safe to share.
- Separate documented env var names from actual values.
- Treat tool descriptions and external server metadata as untrusted unless from a trusted source.

## Retirement

- Move completed or superseded plans to `docs/_legacy/roadmaps/`.
- Move obsolete research to `docs/_legacy/research/`.
- Promote lasting rules before retiring a doc.
- Do not leave hidden open decisions in prose. Put them in a roadmap, report, status note, or decision record.
