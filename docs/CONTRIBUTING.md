# Contributing

Read `AGENTS.md`, the active roadmap, and `docs/operations/development-workflow.md`
before changing Jami Harness.

Use the live repository as source truth. Add `.changes/` fragments for
production-meaningful behavior, docs, operations, automation, release, or security
changes. Run the narrowest complete verification ladder for the touched surface and
record unavailable commands honestly.

Do not weaken correctness gates to make a release story look green. If an account action,
credential, hosted service, package permission, or product decision is required, record it
as an intervention instead of stubbing around it.

Keep Studio UI changes in the sibling `studio-ui` repository. This repo owns harness
runtime, policy, tools, memory, artifacts, observability, CLI, SDK, evidence, docs, and
release-readiness surfaces.
