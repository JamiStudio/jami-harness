# @jami-studio/harness-memory

Dependency-free Stream 4 foundation for memory, search, citation, and deterministic
context replay contracts.

This package currently provides:

- A no-op memory port for stateless runs.
- An in-memory development port with actor, project, scope, retention, and query filtering.
- Memory record normalization with citation freshness and redaction defaults.
- Deterministic context pack assembly with inclusion and dropped-item reasons.

It does not implement a durable memory store, vector search, hosted retrieval,
compression/summarization, external RAG adapters, policy-engine integration, or recall
quality evals yet.
