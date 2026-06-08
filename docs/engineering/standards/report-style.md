# Feasibility Report Style

Use this format for implementation research that shapes scope, architecture, tradeoffs, and decisions before the implementation plan is finalized. Feasibility reports are saved under `docs/research/`.

## Purpose

A feasibility report should answer:

- What is being considered?
- What does the live project currently support?
- What do official/current external sources say?
- What implementation shapes are realistic?
- What are the tradeoffs technically and practically?
- What decisions shape planning or building?
- What does the agent recommend, and why?

## Source Rules

- Use the live project as source of truth for current implementation state.
- Use official, current sources for vendors, APIs, frameworks, protocols, pricing, limits, licensing, security, and standards.
- Do not rely on marketing copy, stale docs, prior plans, or remembered behavior when live files or official docs can be checked.
- Cite sources directly with local paths or URLs.
- Clearly separate verified facts, recommendations, assumptions, and decisions.

## Report Shape

Start each report with:

- `# <Topic> Feasibility Report`
- `Date`
- `Status`
- `Request`
- `Source scope`
- `Owner`

Then include these sections in order:

1. `Executive Summary`
2. `Question Being Answered`
3. `Source Scope And Method`
4. `Current Project State`
5. `Official / External Findings`
6. `Industry Standard Shape`
7. `Implementation Options`
8. `Technical Implications`
9. `Project Implications`
10. `Risks And Constraints`
11. `Recommended Direction`
12. `Decision Points`
13. `Decision Questions For Discussion`
14. `Next Step If Accepted`
15. `Sources`

## Writing Rules

- Keep recommendations opinionated and reversible where architecture should stay adapter-based.
- Only leave creative product direction for user discussion when system and semantic decisions have a clear production-standard answer.
- Do not bury decision points in prose.
- Include source/license/security implications when external tools, model outputs, or public responses are involved.
- Distinguish local feasibility from hosted production feasibility.
- Distinguish implementation cost from operating cost.
- After saving, read back the Markdown and run available docs checks.
