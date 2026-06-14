// PostHog telemetry sink for the harness observability port.
//
// This is the single place the external analytics dependency (`posthog-node`) is
// touched. It implements the telemetry-sink contract consumed by withTelemetry():
//   - captureRunEvent  -> exception capture for failure events ($exception)
//   - captureTrace     -> $ai_trace / $ai_span run-metadata events
//   - captureMetrics   -> folded into the run-metadata events (latency/tokens/cost)
//   - captureRunSummary-> a single $ai_generation roll-up per run (run metadata only)
//   - shutdown         -> flush queued events before a short-lived process exits
//
// Posture (OSS-safe, verified against PostHog LLM-observability docs):
//   - We send RUN METADATA only: $ai_model, $ai_provider, $ai_latency,
//     $ai_input_tokens, $ai_output_tokens, $ai_total_cost_usd, $ai_is_error, etc.
//   - We DO NOT send $ai_input or $ai_output_choices (prompt/response content) unless
//     the caller explicitly opts in AND the upstream records are unredacted — which,
//     by the observability contract, they are not. Prompt fields are redacted upstream.
//   - No PII: the distinct id is a stable, non-identifying installation/run token.
//
// The PostHog client is created lazily (dynamic import) only when this sink is
// constructed, so the harness install graph stays dependency-free unless telemetry
// is enabled. A client may be injected for testing without importing the vendor.

const DEFAULT_HOST = "https://us.posthog.com";

/**
 * Create a PostHog telemetry sink.
 *
 * @param {object} options
 * @param {string} options.key - the PostHog project key (phc_...).
 * @param {string} [options.host] - the PostHog host (defaults to US cloud).
 * @param {string} [options.distinctId] - stable, non-PII distinct id for events.
 * @param {object} [options.client] - a pre-built client (test seam); skips import.
 * @param {Function} [options.createClient] - async factory returning a client
 *   (test seam / custom loader). Defaults to importing `posthog-node`.
 * @param {boolean} [options.captureContent=false] - if true AND records are
 *   unredacted, include $ai_input/$ai_output_choices. Default false (metadata only).
 * @param {Function} [options.onError] - optional diagnostic callback for load/send errors.
 * @returns {object} a telemetry sink (see withTelemetry contract) plus `ready()`.
 */
export function createPostHogTelemetrySink(options = {}) {
  const host = nonEmpty(options.host) ?? DEFAULT_HOST;
  const distinctId = nonEmpty(options.distinctId) ?? "jami-harness-anonymous";
  const captureContent = options.captureContent === true;
  const onError = typeof options.onError === "function" ? options.onError : () => {};

  let clientPromise;
  let resolvedClient = options.client && typeof options.client === "object" ? options.client : undefined;
  let disabled = false;

  async function getClient() {
    if (disabled) return undefined;
    if (resolvedClient) return resolvedClient;
    if (!clientPromise) {
      clientPromise = createClientInstance(options, host).then(
        (client) => {
          resolvedClient = client;
          return client;
        },
        (error) => {
          disabled = true;
          onError(error);
          return undefined;
        },
      );
    }
    return clientPromise;
  }

  function enqueue(work) {
    // Fire-and-forget: telemetry must never block or break a run.
    getClient()
      .then((client) => {
        if (!client) return;
        try {
          work(client);
        } catch (error) {
          onError(error);
        }
      })
      .catch(onError);
  }

  return {
    kind: "posthog",

    // Resolve the client eagerly (used by tests / readiness checks). Returns the
    // client or undefined if it could not be loaded.
    async ready() {
      return getClient();
    },

    captureRunEvent(event) {
      if (!event || typeof event !== "object") return;
      if (!isFailureEvent(event.eventType)) return;
      const properties = compact({
        $exception_type: "HarnessRunFailure",
        harness_event_type: event.eventType,
        harness_run_id: event.runId,
        harness_task_id: event.taskId,
        harness_sequence: event.sequence,
        harness_renderer_state: event.rendererState,
        $ai_trace_id: traceIdFor(event.runId),
      });
      const message = typeof event.message === "string" ? event.message : `harness ${event.eventType}`;
      enqueue((client) => {
        if (typeof client.captureException === "function") {
          client.captureException(toError(message, event.eventType), distinctId, properties);
        } else {
          client.capture({ distinctId, event: "$exception", properties: { ...properties, $exception_message: message } });
        }
      });
    },

    captureTrace(trace) {
      if (!trace || typeof trace !== "object") return;
      const isError = trace.status === "error";
      const event = trace.kind === "provider" ? "$ai_generation" : "$ai_span";
      const attributes = trace.attributes ?? {};
      const properties = compact({
        $ai_trace_id: traceIdFor(trace.runId ?? attributes.runId),
        $ai_span_id: trace.spanId,
        $ai_parent_id: trace.parentSpanId,
        $ai_span_name: trace.name,
        $ai_provider: attributes.providerId,
        $ai_model: attributes.model ?? attributes.providerId,
        $ai_is_error: isError,
        $ai_error: isError ? attributes.reason : undefined,
        harness_run_id: trace.runId,
        harness_trace_kind: trace.kind,
        harness_environment: attributes.environment,
        harness_provider_status: attributes.providerStatus,
        harness_status: trace.status,
      });
      enqueue((client) => client.capture({ distinctId, event, properties }));
    },

    captureMetrics(metrics) {
      if (!Array.isArray(metrics) || metrics.length === 0) return;
      // Metrics are folded into run summaries; emitting a per-metric event would be
      // noisy. We keep this as a no-op forward to preserve the contract surface.
    },

    captureRunSummary(summary) {
      if (!summary || typeof summary !== "object") return;
      const metrics = Array.isArray(summary.metrics) ? summary.metrics : [];
      const usage = foldUsageMetrics(metrics);
      const providerTrace = (Array.isArray(summary.traces) ? summary.traces : []).find(
        (trace) => trace?.kind === "provider",
      );
      const failed = (Array.isArray(summary.events) ? summary.events : []).some((event) =>
        isFailureEvent(event?.eventType),
      );
      const properties = compact({
        $ai_trace_id: traceIdFor(summary.runId),
        $ai_span_name: "jami.harness.run",
        $ai_provider: providerTrace?.attributes?.providerId,
        $ai_model: providerTrace?.attributes?.model ?? providerTrace?.attributes?.providerId,
        $ai_latency: usage.latencySeconds,
        $ai_input_tokens: usage.inputTokens,
        $ai_output_tokens: usage.outputTokens,
        $ai_total_cost_usd: usage.costUsd,
        $ai_is_error: failed,
        // Content is intentionally omitted (run metadata only) unless explicitly enabled.
        $ai_input: captureContent ? summary.input : undefined,
        $ai_output_choices: captureContent ? summary.output : undefined,
        harness_run_id: summary.runId,
        harness_evidence_id: summary.evidenceId,
        harness_subject: summary.subject,
        harness_source_repo: summary.source?.repo,
        harness_source_ref: summary.source?.ref,
        harness_metric_count: metrics.length,
        harness_token_measurement: usage.tokenMeasurement,
      });
      enqueue((client) => client.capture({ distinctId, event: "$ai_generation", properties }));
    },

    async shutdown() {
      const client = resolvedClient ?? (await getClient());
      if (!client) return;
      try {
        if (typeof client.shutdown === "function") {
          await client.shutdown();
        } else if (typeof client.shutdownAsync === "function") {
          await client.shutdownAsync();
        } else if (typeof client.flush === "function") {
          await client.flush();
        }
      } catch (error) {
        onError(error);
      }
    },
  };
}

async function createClientInstance(options, host) {
  if (typeof options.createClient === "function") {
    return options.createClient({ ...options, host });
  }
  const key = nonEmpty(options.key);
  if (!key) {
    throw new Error("createPostHogTelemetrySink requires a PostHog project key");
  }
  // Dynamic import keeps `posthog-node` an optional dependency; the harness install
  // graph stays dependency-free unless telemetry is actually enabled.
  const moduleName = "posthog-node";
  const mod = await import(moduleName);
  const PostHog = mod.PostHog ?? mod.default?.PostHog ?? mod.default;
  if (typeof PostHog !== "function") {
    throw new Error("posthog-node did not export a PostHog client constructor");
  }
  return new PostHog(key, {
    host,
    // Short-lived processes (the CLI) need eager flushing so events leave before exit.
    flushAt: options.flushAt ?? 1,
    flushInterval: options.flushInterval ?? 0,
    // No geo-IP enrichment: keep the footprint minimal and non-identifying.
    disableGeoip: true,
  });
}

function foldUsageMetrics(metrics) {
  const fold = {
    latencySeconds: undefined,
    inputTokens: undefined,
    outputTokens: undefined,
    costUsd: undefined,
    tokenMeasurement: undefined,
  };
  for (const metric of metrics) {
    if (!metric || typeof metric !== "object") continue;
    const value = Number(metric.value);
    if (!Number.isFinite(value)) continue;
    const name = String(metric.name ?? "");
    if (metric.kind === "latency" || metric.unit === "ms" || /latency/.test(name)) {
      // PostHog $ai_latency is expressed in seconds.
      fold.latencySeconds = round((fold.latencySeconds ?? 0) + value / 1000, 6);
    } else if (metric.kind === "tokens" || metric.unit === "tokens") {
      if (/input/.test(name)) fold.inputTokens = (fold.inputTokens ?? 0) + value;
      else if (/output/.test(name)) fold.outputTokens = (fold.outputTokens ?? 0) + value;
      else fold.inputTokens = (fold.inputTokens ?? 0) + value;
      const measurement = metric.dimensions?.tokenMeasurement;
      if (typeof measurement === "string") fold.tokenMeasurement = measurement;
    } else if (metric.kind === "cost" || metric.unit === "usd") {
      fold.costUsd = round((fold.costUsd ?? 0) + value, 8);
    }
  }
  return fold;
}

function isFailureEvent(eventType) {
  return eventType === "run.failed" || eventType === "renderer.error";
}

function traceIdFor(runId) {
  if (typeof runId !== "string" || runId.length === 0) return undefined;
  return runId.replace(/^run_/, "trace_");
}

function toError(message, name) {
  const error = new Error(message);
  error.name = typeof name === "string" ? name : "Error";
  return error;
}

function compact(object) {
  const output = {};
  for (const [key, value] of Object.entries(object)) {
    if (value === undefined || value === null) continue;
    output[key] = value;
  }
  return output;
}

function nonEmpty(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
