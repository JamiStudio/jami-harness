import { createDefaultPolicyEngine, createPolicyGatedRunKernel } from "../../policy/src/index.mjs";

const SCHEMA_VERSION = "2026-06-09";
const ACTION_ID_PATTERN = /^act_[a-z0-9][a-z0-9_-]*$/;
const ROUTE_PATTERN = /^harness:\/\/actions\/[a-z0-9][a-z0-9-]*$/;
const TASK_ID_PATTERN = /^task_[a-z0-9][a-z0-9_-]*$/;
const UI_PAYLOAD_ID_PATTERN = /^uip_[a-z0-9][a-z0-9_-]*$/;
const ARTIFACT_VIEW_ID_PATTERN = /^artv_[a-z0-9][a-z0-9_-]*$/;
const ALLOWED_ACTION_RISKS = new Set(["read", "write", "destructive", "external", "secret_adjacent"]);
const ALLOWED_CONFIRMATION_MODES = new Set(["none", "confirm", "approval_required", "owner_required"]);
const ALLOWED_ACTION_STATES = new Set(["available", "disabled", "denied", "pending_approval", "executed", "failed"]);
const ELEVATED_RISKS = new Set(["write", "destructive", "external", "secret_adjacent"]);

export function createRunLifecycleKernel(options = {}) {
  const now = options.now ?? (() => new Date());
  const runId = normalizeId("run", options.runId);
  const taskId = normalizeOptionalTaskId(options.taskId);
  const actor = options.actor ?? { actorId: "actor_unknown", scopes: [] };
  const projectId = normalizeId("proj", options.projectId);
  const environment = options.environment ?? "unknown";
  const events = [];
  let sequence = 0;

  const eventSink = options.eventSink;
  const auditSink = options.auditSink;

  const policyKernel = createPolicyGatedRunKernel({
    policyEngine: options.policyEngine ?? createDefaultPolicyEngine({ now }),
    auditSink,
  });

  function emit(partial) {
    const event = {
      schemaVersion: SCHEMA_VERSION,
      eventId: makeId("evt", runId, String(sequence), partial.eventType),
      runId,
      taskId,
      sequence,
      occurredAt: now().toISOString(),
      rendererState: "not_requested",
      ...partial,
    };
    sequence += 1;
    events.push(event);
    eventSink?.write?.(event);
    return event;
  }

  return {
    get events() {
      return [...events];
    },

    start(message = "run started") {
      return emit({ eventType: "run.started", message });
    },

    progress(message) {
      return emit({ eventType: "run.progress", message });
    },

    complete(message = "run completed") {
      return emit({ eventType: "run.completed", message });
    },

    fail(error) {
      return emit({ eventType: "run.failed", message: error instanceof Error ? error.message : String(error) });
    },

    emitUiPayload(payload) {
      const validation = validateUiPayload(payload);
      if (!validation.valid) {
        return {
          executable: false,
          errors: validation.errors,
          event: emit({
            eventType: "renderer.error",
            rendererState: "error_state",
            message: validation.errors.join("; "),
          }),
        };
      }

      return {
        executable: false,
        uiPayload: payload,
        event: emit({
          eventType: "ui.payload.emitted",
          uiPayloadRef: payload.payloadId,
          rendererState: "not_requested",
          message: `ui payload emitted: ${payload.payloadId}`,
        }),
      };
    },

    emitArtifactView(artifactView) {
      const validation = validateArtifactView(artifactView);
      if (!validation.valid) {
        return {
          executable: false,
          errors: validation.errors,
          event: emit({
            eventType: "run.failed",
            message: validation.errors.join("; "),
          }),
        };
      }

      return {
        executable: false,
        artifactView,
        event: emit({
          eventType: "artifact.created",
          artifactViewRef: artifactView.artifactViewId,
          message: `artifact view emitted: ${artifactView.artifactViewId}`,
        }),
      };
    },

    async requestAction(actionRef, request = {}) {
      const validation = validateActionRef(actionRef);
      const policyRequest = toPolicyRequest({
        actionRef,
        validationErrors: validation.errors,
        request,
        runId,
        actor,
        projectId,
        environment,
      });

      const result = await policyKernel.gateAction(policyRequest);
      const safeActionRef = toSafeActionRef(actionRef, result.decision, validation.errors);
      const policyEvent = emit({
        eventType: "policy.decision",
        actionRef: safeActionRef.actionId,
        policyDecision: {
          decision: result.decision.decision,
          scope: safeActionRef.policyScope,
          reason: result.decision.reasons.join("; "),
          auditRef: result.decision.auditRef,
        },
        message: result.decision.reasons.join("; "),
      });

      const executable = validation.valid && result.executable && safeActionRef.state === "available";
      const actionEvent = executable
        ? emit({
            eventType: "tool.call.requested",
            actionRef: safeActionRef.actionId,
            message: `policy allowed action ${safeActionRef.actionId}`,
          })
        : undefined;

      return {
        executable,
        actionRef: safeActionRef,
        decision: result.decision,
        auditEvent: result.auditEvent,
        events: actionEvent ? [policyEvent, actionEvent] : [policyEvent],
      };
    },
  };
}

function toPolicyRequest({ actionRef, validationErrors, request, runId, actor, projectId, environment }) {
  const action = isObject(actionRef) ? actionRef : {};
  const risk = ALLOWED_ACTION_RISKS.has(action.risk) ? action.risk : "unknown";
  const requiredScopes = validationErrors.length > 0 ? [] : [action.policyScope].filter(Boolean);
  return {
    ...request,
    runId,
    actor,
    projectId,
    environment,
    action: {
      actionId: ACTION_ID_PATTERN.test(action.actionId ?? "") ? action.actionId : "act_malformed",
      risk,
      confirmationMode: ALLOWED_CONFIRMATION_MODES.has(action.confirmationMode) ? action.confirmationMode : "approval_required",
    },
    requiredScopes,
    threatSignals: {
      ...request.threatSignals,
      toolMetadataPoisoning: request.threatSignals?.toolMetadataPoisoning === true || validationErrors.some((error) => error.includes("metadata")),
      secretExfiltration: request.threatSignals?.secretExfiltration === true || validationErrors.some((error) => error.includes("secret")),
    },
    secretRefs: Array.isArray(action.secretRefs) ? action.secretRefs : request.secretRefs,
  };
}

function toSafeActionRef(actionRef, decision, validationErrors) {
  const action = isObject(actionRef) ? actionRef : {};
  const actionId = ACTION_ID_PATTERN.test(action.actionId ?? "") ? action.actionId : "act_malformed";
  const route = ROUTE_PATTERN.test(action.route ?? "") ? action.route : "harness://actions/malformed";
  const risk = ALLOWED_ACTION_RISKS.has(action.risk) ? action.risk : "secret_adjacent";
  const policyScope = typeof action.policyScope === "string" && action.policyScope.length > 0 ? action.policyScope : "runtime:malformed";
  const label = typeof action.label === "string" && action.label.length > 0 ? action.label : "Malformed action";

  let state = "denied";
  if (decision.decision === "allow" && validationErrors.length === 0) state = "available";
  if (decision.decision === "needs_approval" || decision.decision === "needs_owner") state = "pending_approval";

  return {
    schemaVersion: SCHEMA_VERSION,
    actionId,
    label,
    route,
    risk,
    policyScope,
    confirmationMode: ALLOWED_CONFIRMATION_MODES.has(action.confirmationMode) ? action.confirmationMode : "approval_required",
    state,
    evidenceRef: decision.evidenceRef,
    denial: state === "denied"
      ? {
          reason: [...validationErrors, ...decision.reasons].join("; "),
          auditRef: decision.auditRef,
        }
      : undefined,
  };
}

function validateActionRef(actionRef) {
  const errors = [];
  if (!isObject(actionRef)) return { valid: false, errors: ["actionRef must be an object"] };
  if (actionRef.schemaVersion !== SCHEMA_VERSION) errors.push("actionRef.schemaVersion is invalid");
  if (!ACTION_ID_PATTERN.test(actionRef.actionId ?? "")) errors.push("actionRef.actionId is malformed");
  if (typeof actionRef.label !== "string" || actionRef.label.length === 0) errors.push("actionRef.label is required");
  if (!ROUTE_PATTERN.test(actionRef.route ?? "")) errors.push("actionRef.route is malformed");
  if (!ALLOWED_ACTION_RISKS.has(actionRef.risk)) errors.push("actionRef.risk is unsupported");
  if (typeof actionRef.policyScope !== "string" || actionRef.policyScope.length === 0) errors.push("actionRef.policyScope is required");
  if (!ALLOWED_CONFIRMATION_MODES.has(actionRef.confirmationMode)) errors.push("actionRef.confirmationMode is unsupported");
  if (!ALLOWED_ACTION_STATES.has(actionRef.state)) errors.push("actionRef.state is unsupported");
  if (ELEVATED_RISKS.has(actionRef.risk) && actionRef.confirmationMode === "none") {
    errors.push("actionRef.confirmationMode cannot be none for elevated risk");
  }
  if (hasForbiddenSecretValue(actionRef)) errors.push("actionRef contains inline secret material");
  if (hasExecutableMetadata(actionRef.metadata)) errors.push("actionRef metadata contains executable metadata");
  return { valid: errors.length === 0, errors };
}

function validateUiPayload(payload) {
  const errors = [];
  if (!isObject(payload)) return { valid: false, errors: ["uiPayload must be an object"] };
  if (payload.schemaVersion !== SCHEMA_VERSION) errors.push("uiPayload.schemaVersion is invalid");
  if (!UI_PAYLOAD_ID_PATTERN.test(payload.payloadId ?? "")) errors.push("uiPayload.payloadId is malformed");
  if (!isObject(payload.componentRef)) errors.push("uiPayload.componentRef is required");
  if (!isObject(payload.props)) errors.push("uiPayload.props must be an object");
  if (hasUnsafeUiProp(payload.props)) errors.push("uiPayload props contain executable or raw HTML fields");
  if (hasForbiddenSecretValue(payload)) errors.push("uiPayload contains inline secret material");
  return { valid: errors.length === 0, errors };
}

function validateArtifactView(artifactView) {
  const errors = [];
  if (!isObject(artifactView)) return { valid: false, errors: ["artifactView must be an object"] };
  if (artifactView.schemaVersion !== SCHEMA_VERSION) errors.push("artifactView.schemaVersion is invalid");
  if (!ARTIFACT_VIEW_ID_PATTERN.test(artifactView.artifactViewId ?? "")) errors.push("artifactView.artifactViewId is malformed");
  if (hasForbiddenSecretValue(artifactView)) errors.push("artifactView contains inline secret material");
  return { valid: errors.length === 0, errors };
}

function hasUnsafeUiProp(value) {
  if (!isObject(value)) return false;
  return Object.entries(value).some(([key, child]) =>
    /^on[A-Z]/.test(key) || ["dangerouslySetInnerHTML", "innerHTML", "html"].includes(key) || hasUnsafeUiProp(child)
  );
}

function hasExecutableMetadata(value) {
  if (!isObject(value)) return false;
  return Object.entries(value).some(([key, child]) =>
    ["command", "exec", "script", "code", "functionBody", "toolOverride"].includes(key) || hasExecutableMetadata(child)
  );
}

function hasForbiddenSecretValue(value) {
  if (Array.isArray(value)) return value.some((child) => hasForbiddenSecretValue(child));
  if (!isObject(value)) return false;
  return Object.entries(value).some(([key, child]) =>
    ["value", "plaintext", "tokenValue", "apiKey", "secret"].includes(key) || hasForbiddenSecretValue(child)
  );
}

function normalizeId(prefix, value) {
  const pattern = new RegExp(`^${prefix}_[a-z0-9][a-z0-9_-]*$`);
  return typeof value === "string" && pattern.test(value) ? value : `${prefix}_unknown`;
}

function normalizeOptionalTaskId(value) {
  if (value === undefined) return undefined;
  return TASK_ID_PATTERN.test(value) ? value : "task_unknown";
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function makeId(prefix, ...parts) {
  const body = parts
    .filter(Boolean)
    .join("_")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `${prefix}_${body || "event"}`;
}
