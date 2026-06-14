# Jami Harness Docs

This docs tree is the canonical product and operating source for Jami Harness. Cross-repo
planning, plan/report standards, and agent coordination are canonical in the sibling
`_ops` repo under `_ops/planning/`.

## Start Here

- [Project charter](project/charter.md)
- Production feasibility report: `_ops/planning/jami-harness/research/2026-06-07-jami-harness-production-feasibility-report.md`
- Active production plan: `_ops/planning/jami-harness/roadmaps/2026-06-14-jami-agent-harness-production-completion.md`
- [System architecture](architecture/product-architecture.md)
- [Candidate stack](architecture/candidate-stack.md)
- [Owned core](owned-core/README.md)

## Engineering Control Plane

- Agent goal: `_ops/planning/jami-harness/agents/goal.md`
- Orchestration reliability: `_ops/planning/jami-harness/agents/orchestration-reliability.md`
- Planning style: `_ops/planning/_standards/planning-style.md`
- Report style: `_ops/planning/_standards/report-style.md`
- Documentation standards: `registry/docs/engineering/standards/docs-standards.md`

## Durable Directories

- `docs/project/` - product charter and intent.
- `docs/architecture/` - system shape, integration seams, candidate stack, and diagrams.
- `docs/owned-core/` - contracts and semantics the harness owns.
- `docs/operations/` - setup, release, incident, support, and runbook material.
- `docs/decisions/` - accepted decision records.
- `_ops/planning/jami-harness/research/` - dated feasibility and source reports.
- `_ops/planning/jami-harness/roadmaps/` - active implementation plans.
- `_ops/planning/jami-harness/agents/` - agent workflow and orchestration guidance.

## Project Governance

- [Code of conduct](CODE_OF_CONDUCT.md)
- [Contributing](CONTRIBUTING.md)
- [License](../LICENSE)
- [Notice](../NOTICE)
- [Security](SECURITY.md)
- [Support](SUPPORT.md)

## Publishing Model

Mintlify will become the public docs shell after the canon is stable. Until then, do not duplicate content into a separate docs app. The future Mintlify `docs.json` should index pages from this canonical tree and preserve the same information architecture.
