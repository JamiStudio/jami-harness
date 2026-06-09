# Checkpoint Resume Store Foundation

- Added local replaceable checkpoint store ports with in-memory and filesystem defaults,
  redacted replay hashes, and local approval records.
- Wired SDK and CLI run/resume/approve/doctor surfaces through the checkpoint store.
- Added context/search adapter ports with citation-preserving token-budget assembly.
- Added tests for replay/redaction, path-safe resume, approval evidence, adapter
  capability inspection, and cross-actor memory leakage.
