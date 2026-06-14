---
type: security
surface: observability
---

Adversarial PASS-2 audit of the opt-in PostHog telemetry, plus one hardening fix and
the `docs:check` policy fix.

Fix (PII/secret leak on the egress path): a run event's free-text `message` (e.g.
`run.failed` carries `error.message` verbatim from the runtime) was teed to the telemetry
sink by the `withTelemetry` event seam *before* the base observability port applied its own
redaction, so an unredacted error string could have reached PostHog as the `$exception`
message. The seam now scrubs the forwarded event's free-text fields with a self-contained,
dependency-free, idempotent redactor (`redactRunEventForTelemetry` / `redactTelemetryString`),
and the PostHog sink scrubs the message again as defense in depth so it is safe even when a
caller bypasses the seam. Run metadata, trace attributes, and metric dimensions were already
redacted upstream and remain so; no prompt/response content (`$ai_input`/`$ai_output_choices`)
is ever sent. Also bounded the sink shutdown/flush (default 2s, unref'd timer) so a slow or
unreachable network can never hang the CLI exit path.

Audit result (other bars PASS, unchanged): gating is airtight (OFF by default / on
`DO_NOT_TRACK` / in CI / without a key; ON only with the explicit flag — re-proven across the
full matrix); a sink/network failure never breaks or hangs a run (fault isolation + bounded
flush); the `posthog-node` vendor stays isolated behind a lazy `await import` and an
`optionalDependency`, with the package working when it is absent; and the `$ai_*` property
names + client API (`capture`, `captureException`, `shutdown`, `disableGeoip`, `$ai_latency`
in seconds, `$ai_is_error`) match real `posthog-node@5.37.0` with no drift.

`docs:check` fix: the gate required `docs/research/...feasibility-report.md` and
`docs/roadmaps/...production-plan.md`, but planning is canonical in `_ops`
(`_ops/projects/jami-harness/planning/{research,roadmaps}/`) per
`_ops/docs/source-of-truth-policy.md`. The two relocated planning docs were dropped from the
required-file list (and the stale references in `AGENTS.md` and `check-readiness.mjs` updated
to the `_ops` location) rather than recreated in-repo. Planning docs were not recreated here.

Verified: observability/core/cli/sdk/runtime tests green (observability 23/23, includes new
leak + bounded-shutdown coverage); gating matrix proven with output; `docs:check` GREEN;
secret scan clean (test fixtures use synthetic, non-real tokens). Pre-existing,
telemetry-unrelated `pnpm verify` reds confirmed red on clean `main` and left flagged: the
provider-boundary assertions (`local_deterministic_only` vs `provider_router_local_plus_hosted`
in `check-package-contents.mjs` and `packages/harness/test`) encode a real
hosted-provider-router design decision and must not be blind-fixed; SBOM / docs:generate /
workbench staleness is deterministic snapshot drift from the added `harness` and
`provider-hosted` packages (safe to regenerate); `eval:smoke` cascades from `docs:generate`.
