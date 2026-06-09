# @jami-studio/harness-observability

Dependency-free Stream 4 foundation for run-event capture, trace records, audit capture,
and evidence packet export.

This package currently provides:

- Event and audit sinks that connect to the existing runtime run-event spine.
- Minimal `traceEvent` records with redacted attributes.
- Local evidence packet export backed by the artifact storage port.
- Default redaction for prompts, inline secrets, credentials, private payloads, and tool metadata.

It does not implement OpenTelemetry export, metrics, hosted sinks, eval backends,
incident exports, CLI inspection, or workbench views yet.
