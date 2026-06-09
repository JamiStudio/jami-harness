const DEFAULT_APPROVAL_WINDOW_MS = 15 * 60 * 1000;
const ELEVATED_RISKS = new Set(["write", "destructive", "external", "secret_adjacent"]);

export function createDefaultPolicyEngine(options = {}) {
  const now = options.now ?? (() => new Date());
  const approvalWindowMs = options.approvalWindowMs ?? DEFAULT_APPROVAL_WINDOW_MS;

  return {
    evaluate(request) {
      return evaluatePolicyRequest(request, { now, approvalWindowMs });
    },
  };
}

export function createPolicyGatedRunKernel({ policyEngine = createDefaultPolicyEngine(), auditSink } = {}) {
  return {
    async gateAction(request) {
      const decision = await policyEngine.evaluate(request);
      const auditEvent = toAuditEvent(request, decision);
      await auditSink?.write?.(auditEvent);
      return {
        executable: decision.decision === "allow",
        decision,
        auditEvent,
      };
    },
  };
}

export function evaluatePolicyRequest(request, options = {}) {
  const now = options.now ?? (() => new Date());
  const approvalWindowMs = options.approvalWindowMs ?? DEFAULT_APPROVAL_WINDOW_MS;
  const requestedScopes = asArray(request.requiredScopes);
  const actorScopes = new Set(asArray(request.actor?.scopes));
  const matchedScopes = requestedScopes.filter((scope) => actorScopes.has(scope));
  const reasons = [];
  const redactions = [];

  if (!request.actor?.actorId) reasons.push("actor identity is required");
  if (!request.projectId) reasons.push("project identity is required");
  if (!request.environment) reasons.push("environment is required");

  const missingScopes = requestedScopes.filter((scope) => !actorScopes.has(scope));
  if (missingScopes.length > 0) {
    reasons.push(`missing required scopes: ${missingScopes.join(", ")}`);
  }

  const signalReasons = evaluateThreatSignals(request);
  reasons.push(...signalReasons);

  const secretLeakFields = findSecretValuePaths(request);
  if (secretLeakFields.length > 0) {
    reasons.push("secret values are not allowed in policy requests");
    for (const field of secretLeakFields) {
      redactions.push({ field, mode: "omitted", reason: "secret value blocked before audit emission" });
    }
  }

  const risk = request.action?.risk ?? "read";
  const approval = request.approval;
  const approvalCheck = validateApproval(approval, request, { now, approvalWindowMs });
  if (approvalCheck.reason) {
    reasons.push(approvalCheck.reason);
  }

  let decision = "deny";
  if (reasons.length === 0) {
    if (ELEVATED_RISKS.has(risk) && !approvalCheck.valid) {
      decision = request.action?.confirmationMode === "owner_required" ? "needs_owner" : "needs_approval";
      reasons.push("elevated-risk action requires a current bound approval");
    } else {
      decision = "allow";
      reasons.push("all required scopes and policy controls satisfied");
    }
  }

  if (reasons.some((reason) => reason.includes("secret"))) {
    redactions.push({ field: "request", mode: "redacted", reason: "secret-adjacent policy decision" });
  }

  return {
    schemaVersion: "2026-06-09",
    decisionId: request.decisionId ?? makeId("pol", request.runId, request.action?.actionId, decision),
    runId: request.runId,
    actorId: request.actor?.actorId,
    projectId: request.projectId,
    environment: request.environment,
    decision,
    risk,
    requestedScopes,
    matchedScopes,
    reasons,
    approvalRef: approvalCheck.valid ? approval.approvalId : undefined,
    auditRef: makeId("aud", request.runId, request.action?.actionId, decision),
    evidenceRef: makeId("ev", request.runId, request.action?.actionId, decision),
    redactions: dedupeRedactions(redactions),
    decidedAt: now().toISOString(),
  };
}

export function toAuditEvent(request, decision) {
  return {
    schemaVersion: "2026-06-09",
    auditId: decision.auditRef,
    runId: request.runId,
    actorId: request.actor?.actorId,
    projectId: request.projectId,
    environment: request.environment,
    eventType: decision.decision === "allow" ? "policy.decision" : "tool.denied",
    outcome: decision.decision,
    policyDecisionRef: decision.decisionId,
    approvalRef: decision.approvalRef,
    evidenceRef: decision.evidenceRef,
    secretRefs: asArray(request.secretRefs).map((secretRef) => secretRef.secretId).filter(Boolean),
    occurredAt: decision.decidedAt,
    redactionMode: decision.redactions.length > 0 || decision.decision !== "allow" ? "redacted" : "none",
    summary: decision.reasons.join("; "),
  };
}

function evaluateThreatSignals(request) {
  const reasons = [];
  const signals = request.threatSignals ?? {};

  if (signals.promptInjection === true) {
    reasons.push("prompt injection signal requires denial");
  }
  if (signals.toolMetadataPoisoning === true) {
    reasons.push("tool metadata poisoning signal requires denial");
  }
  if (signals.secretExfiltration === true) {
    reasons.push("secret exfiltration signal requires denial");
  }

  const transport = request.transport;
  if (transport?.kind === "mcp_streamable_http") {
    if (!transport.originTrusted || !transport.sessionBound || !transport.audience) {
      reasons.push("MCP Streamable HTTP requires trusted origin, session binding, and audience");
    }
    if (transport.localhostBinding === "public") {
      reasons.push("MCP local transport cannot bind publicly");
    }
  }

  return reasons;
}

function validateApproval(approval, request, options) {
  const risk = request.action?.risk ?? "read";
  if (!ELEVATED_RISKS.has(risk)) return { valid: true };
  if (!approval) return { valid: false };
  if (approval.status === "replayed") return { valid: false, reason: "approval replay is denied" };
  if (approval.status !== "approved") return { valid: false, reason: "approval is not approved" };
  if (approval.runId !== request.runId) return { valid: false, reason: "approval run binding mismatch" };
  if (approval.actorId !== request.actor?.actorId) return { valid: false, reason: "approval actor binding mismatch" };
  if (approval.actionId !== request.action?.actionId) return { valid: false, reason: "approval action binding mismatch" };

  const requestedScopes = new Set(asArray(request.requiredScopes));
  for (const scope of requestedScopes) {
    if (!asArray(approval.scopes).includes(scope)) {
      return { valid: false, reason: "approval scope binding mismatch" };
    }
  }

  const approvedAt = Date.parse(approval.approvedAt ?? "");
  const expiresAt = Date.parse(approval.expiresAt ?? "");
  const currentTime = options.now().getTime();
  if (Number.isNaN(approvedAt) || Number.isNaN(expiresAt)) {
    return { valid: false, reason: "approval timestamps are required" };
  }
  if (expiresAt <= approvedAt || expiresAt < currentTime || expiresAt - approvedAt > options.approvalWindowMs) {
    return { valid: false, reason: "approval is expired or exceeds allowed approval window" };
  }

  return { valid: true };
}

function findSecretValuePaths(value, path = "$") {
  if (value === null || typeof value !== "object") return [];
  const matches = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (["value", "plaintext", "tokenValue", "apiKey", "secret"].includes(key)) {
      matches.push(childPath);
      continue;
    }
    matches.push(...findSecretValuePaths(child, childPath));
  }
  return matches;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function dedupeRedactions(redactions) {
  const seen = new Set();
  return redactions.filter((redaction) => {
    const key = `${redaction.field}:${redaction.mode}:${redaction.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeId(prefix, ...parts) {
  const body = parts
    .filter(Boolean)
    .join("_")
    .toLowerCase()
    .replace(/^(run|act)_/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  return `${prefix}_${body || "decision"}`;
}
