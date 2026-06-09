---
type: fix
surface: release
---

Hardened the checked SBOM artifact so tracked generation uses a symbolic `git:HEAD`
source marker and reports the resolved commit at command runtime, avoiding post-commit
drift from embedding a self-referential commit hash.
