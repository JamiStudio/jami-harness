---
type: fix
surface: contracts
---

Hardened the Phase 2 shared contract validator so `runEvent` and `actionRef` coverage
states must be backed by matching fixture payload evidence, and added individual state
fixtures for lifecycle and policy-gated action refs.
