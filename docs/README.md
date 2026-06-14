# Jami Harness Docs

This docs tree is the canonical operating source for Jami Harness. Cross-repo planning,
plan/report standards, and agent coordination are canonical in the sibling `_ops` repo.

## Start Here

- [Project charter](project/charter.md)
- [Production feasibility report](research/2026-06-07-jami-harness-production-feasibility-report.md)
- [Active production plan](roadmaps/2026-06-07-jami-harness-production-plan.md)
- [System architecture](architecture/product-architecture.md)
- [Candidate stack](architecture/candidate-stack.md)
- [Owned core](owned-core/README.md)

## Engineering Control Plane

- [Agent goal pointer](engineering/agents/goal.md)
- [Orchestration reliability pointer](engineering/agents/orchestration-reliability.md)
- [Planning style pointer](engineering/standards/planning-style.md)
- [Report style pointer](engineering/standards/report-style.md)
- [Documentation standards pointer](engineering/standards/docs-standards.md)

## Durable Directories

- `docs/project/` - product charter and intent.
- `docs/architecture/` - system shape, integration seams, candidate stack, and diagrams.
- `docs/owned-core/` - contracts and semantics the harness owns.
- `docs/operations/` - setup, release, incident, support, and runbook material.
- `docs/decisions/` - accepted decision records.
- `docs/research/` - dated feasibility and source reports.
- `docs/roadmaps/` - active implementation plans.
- `docs/engineering/` - local pointers to canonical agent workflow and quality standards.

## Publishing Model

Mintlify will become the public docs shell after the canon is stable. Until then, do not duplicate content into a separate docs app. The future Mintlify `docs.json` should index pages from this canonical tree and preserve the same information architecture.
