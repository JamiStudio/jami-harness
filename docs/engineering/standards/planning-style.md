# Implementation Planning Style

Use this format for reusable implementation plans that guide real work, survive handoff, and retire cleanly once complete. Plans should define a production-shaped target and concrete execution sequencing. Do not frame the product as a throwaway or partial product tier.

## Plan Shape

Start each plan with:

- `# <Domain Or Feature> Implementation Plan`
- `Date`, `Status`, `Source reports`, `Owner`, and `Surface`
- A short `Purpose` section that states the outcome and scope
- `Status Legend` using `[ ]`, `[~]`, `[x]`, and `[!]`

Then include these sections in order:

1. `Source Findings`: facts discovered from code, docs, data, tests, product behavior, or source reports.
2. `Locked Decisions`: choices that stay stable during implementation and change only when source-truth facts change.
3. `Scope Boundaries`: concise boundaries for security, runtime exposure, provider behavior, migrations, and public claims.
4. `Repo Guidance`: local rules that shape implementation.
5. `Target Repository Shape` or `Target Harness Shape`: concrete files, packages, contracts, workflow suites, provider adapters, docs outputs, CLI entry points, and operating model.
6. `Cross-Stream Dependency Map`: which streams must land first and which streams consume their outputs.
7. `Workstream N: <Name>` sections with goal, dependencies, primary areas, implementation tasks, exit criteria, and suggested verification.
8. `Final Verification And Closeout`: required commands, cleanup, changelog, docs generation, staging, commit, and push expectations when Git exists.
9. `Acceptance Criteria`: the complete definition of done.
10. `Implementation Order`: dependency-ordered sequence for agents or engineers.
11. `Expansion Track`: future-compatible enhancements that belong in the final product shape but can be sequenced after foundations.

## Writing Rules

- Search before locking the plan. Cite local source reports, docs, packages, services, scripts, migrations, or tests by path.
- Use official/current sources for drift-prone external protocols, provider APIs, security guidance, packaging, and docs tooling.
- Design streams in dependency order: contracts before adapters, policy before tools, audit before automation, docs canon before generated docs.
- Keep streams complete: implementation, tests, docs, changelog/source-map updates, and verification.
- Write tasks as verifiable outcomes, not vague intentions.
- Keep durable rules in architecture, operations, security, or engineering docs. A retired plan is history, not the living contract.
- Include changelog and generated-doc requirements when production-meaningful code, docs, scripts, contracts, CI, security, or operations behavior changes.
- End with final cleanup and publishing expectations.

## Workstream Template

```markdown
## Workstream N: <Name>

Goal: <one-sentence outcome>

Depends on:

- [ ] Workstream X output or existing contract that must exist first.

Enables:

- [ ] Workstream Y or product capability that consumes this result.

Primary areas:

- `path/or/package`

Implementation tasks:

- [ ] Concrete task with an observable result.

Exit criteria:

- [ ] Durable state that confirms this stream is done.

Suggested verification:

- `<focused command or readback check>`
```

## Retirement Rules

When a plan is complete:

- Update checkboxes and closeout notes truthfully.
- Move dated plans to `docs/_legacy/roadmaps/` after durable docs and changelog records carry ongoing rules.
- Promote permanent decisions into `docs/decisions/` or durable docs.
- Keep active docs pointed at current operating guidance.
