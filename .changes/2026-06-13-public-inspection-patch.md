---
type: fix
surface: sdk
---

Updated public SDK/CLI inspection and generated readiness surfaces so public npm install, package provenance, and release attestation evidence are no longer reported as unavailable after the 0.1.0 release. Prepared the changed core, SDK, and CLI packages for a 0.1.1 patch release and added a configurable hosted route smoke gate that remains fail-closed when hosted provider, store, or OTLP secrets are absent.
