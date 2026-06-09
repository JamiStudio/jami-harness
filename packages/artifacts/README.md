# @jami-studio/harness-artifacts

Dependency-free Stream 4 foundation for artifact provenance and storage-port shape.

This package currently provides:

- `artifactRecord` creation with run, source commit, evidence, trace, and audit provenance.
- A replaceable storage-port shape with a default in-memory implementation.
- Secret-adjacent payload omission and redaction metadata by default.
- `artifactView` projection for Studio UI display without exposing artifact payloads.

It does not implement filesystem/object storage, artifact promotion workflows, docs or
changelog generation, hosted stores, release packets, or renderer implementations yet.
