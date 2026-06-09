---
type: fix
surface: repo
---

Wire `pnpm verify` through the non-publishing release readiness and dry-run audits, and
make release audit output deterministic for a given Git `HEAD` by deriving `generatedAt`
from the current commit date instead of wall-clock time.
