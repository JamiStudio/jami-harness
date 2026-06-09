# @jami-studio/harness-store-local

Local replaceable checkpoint store foundation for Jami Harness runtime state.

Current capabilities:

- In-memory checkpoint store for SDK tests and stateless development.
- Filesystem checkpoint store under `.jami-harness/checkpoints/` for CLI resume smokes.
- Local approval records under `.jami-harness/approvals/`.
- Redaction of prompt, secret, credential, token, and private payload fields before
  checkpoint persistence.
- Deterministic replay hashes for checkpoint evidence.
- Path-safe run/action identifier validation before filesystem reads or writes.

This package is not a hosted durable store, database adapter, sync layer, multi-user
control plane, or provider runtime. Those surfaces remain replaceable future store
adapters behind the same checkpoint/resume/approval port shape.
