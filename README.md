# Jami Harness

Jami Harness is the `@jami-studio/harness` foundation for the `jami.studio` open-source platform. The canonical repository is `JamiStudio/jami-harness`. It sits beside Studio UI (`@jami-studio/ui`) and `@jami-studio/orchestra` as one of the core foundations consumed by Intercal, the Collective, yrka, and future Jami Studio products.

It is not a narrow app integration. It owns the agent product grammar, governance model, runtime contracts, artifact lifecycle, tool policy, memory semantics, observability spine, documentation pipeline, and developer experience that downstream products can trust.

This workspace currently includes imported project context from `daily-briefs`, `evals`, `Modal`, `proxies`, `Sherlock`, `upscaler`, `yrka`, `zavi`, `_legacy`, and `references`. Treat those directories as source context unless a future implementation plan explicitly promotes code into the harness core.

## Canon

- [Project charter](docs/project/charter.md)
- [Docs index](docs/README.md)
- Master synthesis: `_ops/planning/_research/master/`
- Production feasibility report: `_ops/planning/jami-harness/research/2026-06-07-jami-harness-production-feasibility-report.md`
- Active production plan: `_ops/planning/jami-harness/roadmaps/2026-06-14-jami-agent-harness-production-completion.md`
- Agent orchestration goal: `_ops/planning/jami-harness/agents/goal.md`
- [Candidate stack](docs/architecture/candidate-stack.md)
- [Owned core map](docs/owned-core/README.md)
- [Release readiness gate](docs/operations/release-readiness.md)

## Operating Principle

Own the semantics that make the product differentiated. Stand on official open protocols, proven OSS, and generous provider infrastructure where they accelerate delivery without taking ownership of the product contract.

The harness should be production-shaped from the first official plan: documented, testable, observable, governed, recoverable, secure by default, docs-ready for Mintlify, and useful to both human developers and agent workers.
