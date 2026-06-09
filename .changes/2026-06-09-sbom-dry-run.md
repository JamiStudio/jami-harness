---
type: ops
surface: repo
---

Added dependency-free local SBOM dry-run generation and drift checking through
`pnpm sbom:generate` and `pnpm sbom:check`, with CycloneDX source-lock evidence and
release-readiness wiring. Verified by `pnpm sbom:generate`, `pnpm sbom:check`, and the
full local gate.
