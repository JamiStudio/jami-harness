# @jami-studio/harness-observability

Dependency-free Stream 4 foundation for run-event capture, trace records, audit capture,
and evidence packet export.

This package currently provides:

- Event and audit sinks that connect to the existing runtime run-event spine.
- Minimal `traceEvent` records with redacted attributes.
- Local `metricRecord` capture for latency, token, cost, and tool-call measurements with
  redacted dimensions.
- Local evidence packet export backed by the artifact storage port.
- Metric-summary artifacts referenced by evidence packet output.
- Default redaction for prompts, inline secrets, credentials, private payloads, and tool metadata.

It does not implement OpenTelemetry export, hosted sinks, external eval backends,
incident exports, CLI inspection, or workbench views yet.
