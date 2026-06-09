---
type: docs
surface: docs
---

Added SDK/CLI install-path inspection and a generated install-readiness manifest covering the current full local source-checkout path plus modular BYO memory, context, search, store, provider, policy, tools, artifacts, observability, and docs-output paths. Verified with `pnpm sdk:test`, `pnpm cli:test`, `pnpm docs:generate -- --check`, and `pnpm release:readiness`.
