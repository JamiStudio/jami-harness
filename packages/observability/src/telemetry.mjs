// OSS-safe telemetry seam for the harness observability port.
//
// This module is dependency-free. It provides:
//   - resolveTelemetryGate(env): the opt-in/disclosed gate that decides whether
//     telemetry may initialize at all (env-driven, honors DO_NOT_TRACK, OFF in
//     CI and dev by default, requires an explicit project key).
//   - withTelemetry(baseObservability, telemetrySink): a decorator that tees the
//     existing run-event spine, traces, metrics, and run summaries to an external
//     telemetry sink without altering the observability contract or its redaction.
//   - createNoopTelemetrySink(): a clean no-op sink used when telemetry is disabled.
//
// The external analytics vendor never appears here. The vendor adapter lives in a
// separate file and is only loaded when the gate is enabled, keeping the harness
// dependency-free by default. The decorator forwards already-redacted records from
// the base observability port, so prompts/secrets are never re-introduced.

const TRUE_FLAG = /^(1|true|yes|on)$/i;

/**
 * Resolve whether OSS-safe telemetry is permitted to initialize.
 *
 * Order of precedence (fail-closed):
 *   1. DO_NOT_TRACK set to a truthy value -> disabled (industry opt-out signal).
 *   2. JAMI_TELEMETRY not explicitly truthy -> disabled (opt-in required).
 *   3. CI detected and not force-enabled -> disabled (no telemetry from CI by default).
 *   4. No project key resolvable -> disabled (nothing to send to).
 * Only when none of the above trip is telemetry enabled.
 *
 * @param {Record<string, string|undefined>} [env=process.env]
 * @returns {{ enabled: boolean, reason: string, key?: string, host?: string,
 *   flag: boolean, doNotTrack: boolean, ci: boolean }}
 */
export function resolveTelemetryGate(env = process.env) {
  const flag = isTruthyFlag(env.JAMI_TELEMETRY);
  const doNotTrack = isDoNotTrack(env.DO_NOT_TRACK);
  const ci = isCi(env);
  const forceCi = isTruthyFlag(env.JAMI_TELEMETRY_ALLOW_CI);
  const key = resolveKey(env);
  const host = resolveHost(env);

  if (doNotTrack) {
    return gate(false, "disabled_do_not_track", { flag, doNotTrack, ci, host });
  }
  if (!flag) {
    return gate(false, "disabled_opt_in_flag_unset", { flag, doNotTrack, ci, host });
  }
  if (ci && !forceCi) {
    return gate(false, "disabled_ci_environment", { flag, doNotTrack, ci, host });
  }
  if (!key) {
    return gate(false, "disabled_missing_project_key", { flag, doNotTrack, ci, host });
  }
  return gate(true, "enabled", { flag, doNotTrack, ci, key, host });
}

function gate(enabled, reason, rest) {
  return { enabled, reason, ...rest };
}

function isTruthyFlag(value) {
  return typeof value === "string" && TRUE_FLAG.test(value.trim());
}

// DO_NOT_TRACK convention: any value other than "0"/empty means "do not track".
// Per https://consoledonottrack.com the presence of DO_NOT_TRACK=1 opts out;
// we treat any non-"0", non-empty value as opt-out to be conservative.
function isDoNotTrack(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "0" || /^false$/i.test(trimmed)) return false;
  return true;
}

function isCi(env) {
  // Common CI signals. Treat the generic CI flag plus well-known providers.
  if (isTruthyFlag(env.CI) || env.CI === "true") return true;
  return Boolean(
    env.GITHUB_ACTIONS ||
      env.GITLAB_CI ||
      env.BUILDKITE ||
      env.CIRCLECI ||
      env.TRAVIS ||
      env.TEAMCITY_VERSION ||
      env.TF_BUILD ||
      env.JENKINS_URL ||
      env.bamboo_buildKey,
  );
}

function resolveKey(env) {
  const candidate = env.POSTHOG_KEY ?? env.POSTHOG_PROJECT_KEY ?? env.POSTHOG_HARNESS_KEY;
  if (typeof candidate !== "string") return undefined;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveHost(env) {
  const candidate = env.POSTHOG_HOST;
  if (typeof candidate !== "string") return undefined;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * A telemetry sink contract (all methods optional; the decorator guards each call):
 *   - captureRunEvent(event): a runtime run-event spine record (already redacted).
 *   - captureTrace(trace): a redacted trace/span record.
 *   - captureMetrics(metrics): an array of normalized, redacted metric records.
 *   - captureRunSummary(summary): an end-of-run roll-up for LLM-observability.
 *   - shutdown(): flush and release resources (returns a Promise).
 */
export function createNoopTelemetrySink() {
  return {
    kind: "noop",
    captureRunEvent() {},
    captureTrace() {},
    captureMetrics() {},
    captureRunSummary() {},
    async shutdown() {},
  };
}

/**
 * Wrap a base observability port so its already-redacted records are also teed to
 * an external telemetry sink. The returned object preserves the full observability
 * surface (sinks, trace, metric recorders, evidence export, getters, capabilities)
 * so it remains a drop-in for composeHarnessCore's `observability` port.
 *
 * Telemetry failures never affect the harness: every forward is wrapped so a sink
 * error cannot break a run.
 *
 * @param {object} base - a createRunObservability()-shaped port.
 * @param {object} [sink] - a telemetry sink; defaults to a no-op.
 * @returns {object} the wrapped observability port with an added `telemetry` handle.
 */
export function withTelemetry(base, sink = createNoopTelemetrySink()) {
  if (!base || typeof base !== "object") {
    throw new TypeError("withTelemetry requires a base observability port");
  }
  const safeSink = sink ?? createNoopTelemetrySink();

  const wrappedEventSink = {
    write(event) {
      base.eventSink?.write?.(event);
      safeForward(() => safeSink.captureRunEvent?.(event));
    },
  };

  const wrappedMetricSink = {
    write(metric) {
      const recorded = base.metricSink?.write?.(metric);
      // Forward the normalized record the base produced when available, else the input.
      safeForward(() => safeSink.captureMetrics?.([recorded ?? metric]));
      return recorded;
    },
  };

  function trace(name, input = {}) {
    const record = base.trace(name, input);
    safeForward(() => safeSink.captureTrace?.(record));
    return record;
  }

  function recordMetric(name, input = {}) {
    const record = base.recordMetric?.(name, input);
    if (record) safeForward(() => safeSink.captureMetrics?.([record]));
    return record;
  }

  function recordUsageMetrics(input = {}) {
    const records = base.recordUsageMetrics?.(input) ?? [];
    if (records.length > 0) safeForward(() => safeSink.captureMetrics?.(records));
    return records;
  }

  function exportEvidencePacket(input = {}) {
    const result = base.exportEvidencePacket(input);
    safeForward(() =>
      safeSink.captureRunSummary?.({
        runId: result.packet?.evidenceId ? input.runId : input.runId,
        evidenceId: result.packet?.evidenceId,
        subject: result.packet?.subject,
        source: result.packet?.source,
        containsSecrets: result.packet?.redaction?.containsSecrets === true,
        metrics: result.metrics ?? [],
        traces: result.traces ?? [],
        events: result.events ?? [],
        audits: result.audits ?? [],
      }),
    );
    return result;
  }

  const wrapped = {
    ...base,
    capabilities: {
      ...(base.capabilities ?? {}),
      telemetry: safeSink.kind && safeSink.kind !== "noop" ? safeSink.kind : "disabled",
    },
    eventSink: wrappedEventSink,
    auditSink: base.auditSink,
    metricSink: wrappedMetricSink,
    trace,
    recordMetric,
    recordUsageMetrics,
    exportEvidencePacket,
    telemetry: safeSink,
    async shutdown() {
      await safeForwardAsync(() => safeSink.shutdown?.());
    },
  };

  // Preserve live getters from the base (events/audits/traces/metrics, artifactStore).
  for (const name of ["events", "audits", "traces", "metrics"]) {
    const descriptor = Object.getOwnPropertyDescriptor(base, name);
    if (descriptor && typeof descriptor.get === "function") {
      Object.defineProperty(wrapped, name, { get: descriptor.get, enumerable: true });
    }
  }
  if (base.artifactStore && !wrapped.artifactStore) {
    wrapped.artifactStore = base.artifactStore;
  }

  return wrapped;
}

function safeForward(fn) {
  try {
    fn();
  } catch {
    // Telemetry must never break a run. Swallow sink errors.
  }
}

async function safeForwardAsync(fn) {
  try {
    await fn();
  } catch {
    // Telemetry must never break a run. Swallow sink errors.
  }
}
