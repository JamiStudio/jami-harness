---
type: feature
surface: observability
---

Added OSS-safe, opt-in PostHog product telemetry behind the harness observability port:
an env-driven gate (`resolveTelemetryGate`), a `withTelemetry` decorator that tees the
existing redacted run events, traces, metrics, and run summaries to a telemetry sink, and a
`posthog-node` adapter (`createPostHogTelemetrySink`) that maps them to `$ai_generation` /
`$ai_span` LLM-observability events plus `$exception` error tracking. Telemetry sends run
metadata only (latency, token estimates, cost, error flags) — never prompt/response content
or PII — and is OFF by default: it initializes only when `JAMI_TELEMETRY` is set, `DO_NOT_TRACK`
is unset, the process is not CI, and a PostHog key is present. The vendor module is an optional
dependency loaded lazily, so the harness install graph stays dependency-free when telemetry is
unused, and `composeHarnessCore` exposes `shutdownTelemetry()` so the CLI flushes before exit.
Verified: `pnpm verify` green; default-OFF, `DO_NOT_TRACK`, and CI gates proven; events accepted
by the jami-harness PostHog project at the capture endpoint (HTTP 200). Documented in
`docs/operations/telemetry.md`.
