---
surface: tools
type: fix
date: 2026-06-09
---

Hardened the tool gateway confirmation pass so replaceable policy-engine failures fail
closed as typed denied executions, non-cooperative handlers return deterministic timeout
records, and failed-tool error messages are redacted before traces or artifacts record
them.
