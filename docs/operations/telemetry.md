# Telemetry & Privacy

Date: 2026-06-14
Status: Active operating procedure

Jami Harness can emit optional product telemetry to a PostHog project to help improve
the agent runtime. Telemetry is **OSS-safe**: it is opt-in, disclosed here, honors the
`DO_NOT_TRACK` convention, is **OFF by default** (including in CI and dev), carries no
PII, and never captures prompt or response content.

## What is collected (only when enabled)

Telemetry sends **run metadata only**, derived from the harness observability port after
its existing redaction has been applied:

- **LLM observability** (`$ai_generation` / `$ai_span` events): run/provider span name,
  provider id, model id when known, latency, input/output token estimates, external
  billable cost (currently `0` for the local deterministic provider), and an error flag.
- **Error / exception tracking** (`$exception`): harness run failures and renderer-error
  events, with the harness run id, event type, and message — no payloads.
- **Feature flags**: when the application checks a flag, PostHog records the standard
  flag-evaluation interaction for that flag key.

The distinct id is a stable, non-identifying installation/run token. It defaults to an
anonymous value and should never be set to anything that identifies a person.

## What is never collected

- **No prompt or response content.** The `$ai_input` and `$ai_output_choices` fields are
  intentionally omitted. The observability contract already redacts prompts, secrets,
  credentials, private payloads, and tool metadata before anything reaches the sink, and
  the PostHog adapter sends metadata fields only.
- **No PII.** Geo-IP enrichment is disabled on the client.
- **No session replay and no DOM autocapture** (the harness is a server/CLI surface with
  no DOM; these are also disabled at the PostHog project level).

## How it is gated (default OFF)

Telemetry initializes only when **all** of the following are true. If any fails, there is
no PostHog client, no network call, and no events — a clean no-op:

1. `JAMI_TELEMETRY` is truthy (`1`, `true`, `yes`, or `on`).
2. `DO_NOT_TRACK` is unset (or `0` / `false`).
3. The process is **not** running in CI (`CI` and common provider variables are checked).
   An explicit `JAMI_TELEMETRY_ALLOW_CI=1` is required to permit telemetry from CI.
4. A PostHog project key is resolvable (`POSTHOG_KEY`, or `POSTHOG_HARNESS_KEY`).

The gate is implemented by `resolveTelemetryGate()` in
`packages/observability/src/telemetry.mjs`. The current posture is visible at runtime via
`harness.inspect().telemetry` and `harness.inspect().boundaries.telemetry`.

## How to opt out

Telemetry is already off unless you opt in. To be explicit, or to disable it where it was
enabled:

- Leave `JAMI_TELEMETRY` unset (or set it to an empty value), **or**
- Set `DO_NOT_TRACK=1` (this overrides `JAMI_TELEMETRY` unconditionally).

You can also disable it in code by passing `disableTelemetry: true` to `createHarness()` /
`composeHarnessCore()`.

## How to opt in (local)

```bash
# .env (gitignored) — never commit real keys; .env.example holds empty placeholders.
POSTHOG_KEY=phc_...            # publishable project key for the jami-harness project
POSTHOG_HOST=https://us.posthog.com
JAMI_TELEMETRY=1
```

With these set (and `DO_NOT_TRACK` unset, outside CI), a `jami run` emits its run-metadata
events and flushes them before the process exits. Disabling any condition restores the
no-op path.

## Architecture (port / adapter)

The external analytics dependency is kept behind the harness observability port, not
sprinkled through the codebase:

- `packages/observability/src/telemetry.mjs` — the env-driven gate, a `withTelemetry()`
  decorator that tees already-redacted run events, traces, metrics, and run summaries to a
  telemetry sink, and a no-op sink. Dependency-free.
- `packages/observability/src/posthog-sink.mjs` — the only place `posthog-node` is touched.
  It maps harness records to PostHog `$ai_*` / `$exception` events, lazily importing the
  vendor module (an `optionalDependency`) so the harness install graph stays dependency-free
  unless telemetry is actually used. Telemetry failures can never break a run.
- `packages/core/src/index.mjs` — opts in to the PostHog sink only when the gate allows and
  no custom observability port was injected, and exposes `shutdownTelemetry()` so short-lived
  surfaces (the CLI) flush before exit.

Replaceability is preserved: injecting a custom `observability` port (or `telemetrySink`)
bypasses the default PostHog wiring entirely.
