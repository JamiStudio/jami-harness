---
kind: fixed
surface: contracts
---

Hardened the Phase 2 shared-seam validator so `uiPayload` coverage cannot
aggregate multiple negative states in one fixture. Added separate machine-readable
fixtures for invalid props, stale vocabulary, unknown components, package imports,
serialized React markers, HTML/script strings, handler props, and secret-shaped values.
