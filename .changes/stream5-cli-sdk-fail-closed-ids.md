---
type: fix
surface: sdk
---

Hardened the Stream 5 CLI and SDK local evidence path so malformed run, artifact, and
evidence identifiers fail with structured errors before local state or evidence artifacts
are read or written. Invalid injected core modules now fail during SDK construction.
