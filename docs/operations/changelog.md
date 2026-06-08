# Changelog System

Status: Active
Last updated: 2026-06-07

## Purpose

Jami Agent Harness uses `.changes/` fragments as the source for production-meaningful change notes.
Fragments keep workstream changes reviewable before release notes are compiled.

## When To Add A Fragment

Add a `.changes/<slug>.md` fragment when a change affects:

- contracts, schemas, generated outputs, or compatibility fixtures
- runtime, policy, tools, memory, context, artifacts, observability, CLI, SDK, or package behavior
- scripts, package metadata, CI, release, or publishing behavior
- security, operations, docs, source registry, diagramming, or account setup rules

Docs-only setup work can use a fragment when it changes durable operating behavior.

## Fragment Format

```markdown
---
type: docs|feature|fix|security|ops|chore
surface: contracts|runtime|policy|tools|memory|context|artifacts|observability|cli|sdk|docs|repo
---

Short plain-language description of the change and verification evidence.
```

## Release Notes

Release notes are compiled from fragments once package/release tooling exists. Until then, keep
fragments as durable review notes and do not delete them unless a release closeout explicitly consumes
them.

## Rules

- Do not include secrets, account tokens, signed URLs, or private provider data.
- Keep fragments short and factual.
- Link to durable docs when a rule was promoted.
- Include verification evidence when a fragment describes behavior, automation, release, publishing,
  or generated output changes.
