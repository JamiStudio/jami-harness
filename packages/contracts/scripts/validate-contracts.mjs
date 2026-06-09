import { readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const schemaRoot = join(packageRoot, "schemas");
const fixtureRoot = join(packageRoot, "fixtures");

const requiredAnchors = new Map([
  ["runEvent", "run-event.schema.json"],
  ["uiPayload", "ui-payload.schema.json"],
  ["artifactView", "artifact-view.schema.json"],
  ["actionRef", "action-ref.schema.json"],
  ["themeRef", "theme-ref.schema.json"],
  ["suiteRef", "suite-ref.schema.json"],
  ["capabilityManifest", "capability-manifest.schema.json"],
  ["primitiveManifest", "primitive-manifest.schema.json"],
  ["policyDecision", "policy-decision.schema.json"],
  ["approvalRequest", "approval-request.schema.json"],
  ["auditEvent", "audit-event.schema.json"],
  ["secretRef", "secret-ref.schema.json"],
  ["evidencePacket", "evidence-packet.schema.json"],
  ["artifactRecord", "artifact-record.schema.json"],
  ["traceEvent", "trace-event.schema.json"],
  ["memoryRecord", "memory-record.schema.json"],
  ["contextPack", "context-pack.schema.json"],
  ["toolExecution", "tool-execution.schema.json"],
  ["threatModelFixtureCatalog", "threat-model-fixture-catalog.schema.json"],
]);

const requiredFixtureAnchors = new Set(requiredAnchors.keys());
const requiredNegativeCaseIds = new Set([
  "invalid-denied-action-ref",
  "invalid-renderer-error-run-event",
  "invalid-ui-payload",
  "invalid-ui-unsafe-prop",
  "invalid-evidence-packet-no-command",
  "invalid-secret-ref-value-leak",
  "invalid-approval-replay-token",
  "invalid-policy-decision-without-audit",
  "invalid-memory-cross-actor-leakage",
  "invalid-tool-execution-missing-audit",
]);
const fixtureCoverage = new Map();
const negativeCaseCoverage = new Set();
const failures = [];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`${relative(packageRoot, path)} is not valid JSON: ${error.message}`);
    return undefined;
  }
}

function listJsonFiles(root) {
  const entries = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      entries.push(...listJsonFiles(path));
    } else if (entry.endsWith(".json")) {
      entries.push(path);
    }
  }
  return entries;
}

function isWithin(root, path) {
  const relativePath = relative(root, path);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function validate(schema, value, path = "$") {
  const errors = [];

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path} must be one of ${schema.enum.join(", ")}`);
  }

  if (schema.type) {
    const actual = Array.isArray(value) ? "array" : value === null ? "null" : Number.isInteger(value) ? "integer" : typeof value;
    const accepted = Array.isArray(schema.type) ? schema.type : [schema.type];
    const typeMatches = accepted.some((type) => {
      if (type === "integer") return Number.isInteger(value);
      if (type === "array") return Array.isArray(value);
      if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
      return actual === type;
    });
    if (!typeMatches) {
      errors.push(`${path} must be ${accepted.join(" or ")}`);
      return errors;
    }
  }

  if (typeof value === "string") {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path} must match ${schema.pattern}`);
    }
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
      errors.push(`${path} must be a date-time`);
    }
  }

  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${path} must be >= ${schema.minimum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path} must contain at least ${schema.minItems} items`);
    }
    if (schema.items) {
      value.forEach((item, index) => errors.push(...validate(schema.items, item, `${path}[${index}]`)));
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const required = schema.required ?? [];
    for (const key of required) {
      if (!(key in value)) {
        errors.push(`${path}.${key} is required`);
      }
    }

    const properties = schema.properties ?? {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          errors.push(`${path}.${key} is not allowed`);
        }
      }
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (key in value) {
        errors.push(...validate(propertySchema, value[key], `${path}.${key}`));
      }
    }
  }

  return errors;
}

function findUnsafeUiPropPath(value, path = "$.props") {
  if (value === null || typeof value !== "object") return undefined;

  for (const [key, child] of Object.entries(value)) {
    if (/^on[A-Z]/.test(key) || key === "dangerouslySetInnerHTML" || key === "innerHTML" || key === "html") {
      return `${path}.${key}`;
    }

    const childPath = findUnsafeUiPropPath(child, `${path}.${key}`);
    if (childPath) return childPath;
  }

  return undefined;
}

function validateSemantics(schemaTitle, value) {
  const errors = [];

  if (schemaTitle === "actionRef") {
    if (value.state === "denied" && !value.denial) {
      errors.push("$.denial is required when $.state is denied");
    }
    if (value.state !== "denied" && value.denial) {
      errors.push("$.denial is only allowed when $.state is denied");
    }
    if (["destructive", "external", "secret_adjacent"].includes(value.risk) && value.confirmationMode === "none") {
      errors.push("$.confirmationMode cannot be none for elevated-risk actions");
    }
  }

  if (schemaTitle === "runEvent") {
    if (value.eventType === "renderer.error" && value.rendererState !== "error_state") {
      errors.push("$.rendererState must be error_state for renderer.error events");
    }
    if (value.eventType === "ui.payload.emitted" && !value.uiPayloadRef) {
      errors.push("$.uiPayloadRef is required for ui.payload.emitted events");
    }
    if (value.eventType === "policy.decision" && !value.policyDecision) {
      errors.push("$.policyDecision is required for policy.decision events");
    }
  }

  if (schemaTitle === "policyDecision") {
    if (value.decision !== "allow" && !value.auditRef) {
      errors.push("$.auditRef is required for non-allow decisions");
    }
    if (value.decision === "allow" && value.risk !== "read" && !value.approvalRef) {
      errors.push("$.approvalRef is required when elevated-risk actions are allowed");
    }
    if (value.redactions.some((redaction) => redaction.mode === "none" && redaction.reason.includes("secret"))) {
      errors.push("$.redactions cannot use mode none for secret-related reasons");
    }
  }

  if (schemaTitle === "approvalRequest") {
    const requestedAt = Date.parse(value.requestedAt);
    const expiresAt = Date.parse(value.expiresAt);
    if (!Number.isNaN(requestedAt) && !Number.isNaN(expiresAt) && expiresAt <= requestedAt) {
      errors.push("$.expiresAt must be after $.requestedAt");
    }
    if (value.status === "replayed" && !value.replayRef) {
      errors.push("$.replayRef is required when $.status is replayed");
    }
    if (value.approvalToken || value.tokenValue) {
      errors.push("approval token values are not allowed in approval request contracts");
    }
  }

  if (schemaTitle === "auditEvent") {
    if (value.outcome !== "allow" && value.redactionMode === "none") {
      errors.push("$.redactionMode cannot be none for non-allow audit outcomes");
    }
    if (value.secretRefs?.some((secretRef) => /value|token|key|secret/i.test(secretRef))) {
      errors.push("$.secretRefs must contain reference ids only, not secret-looking values");
    }
  }

  if (schemaTitle === "secretRef") {
    for (const forbidden of ["value", "plaintext", "token", "apiKey", "secret"]) {
      if (forbidden in value) {
        errors.push(`$.${forbidden} is not allowed in secret references`);
      }
    }
  }

  if (schemaTitle === "uiPayload") {
    if (value.componentRef.allowlisted === false && value.fallback.mode !== "unsupported_component") {
      errors.push("$.fallback.mode must be unsupported_component when $.componentRef.allowlisted is false");
    }

    const unsafePropPath = findUnsafeUiPropPath(value.props);
    if (unsafePropPath) {
      errors.push(`${unsafePropPath} is not allowed in data-only UI payload props`);
    }
  }

  if (schemaTitle === "artifactView") {
    value.renderers.forEach((renderer, index) => {
      if (renderer.mode === "studio_ui" && !renderer.componentRef) {
        errors.push(`$.renderers[${index}].componentRef is required for studio_ui renderers`);
      }
    });
  }

  if (schemaTitle === "suiteRef") {
    if (value.installedItems.some((item) => !item.startsWith("@jami-studio/ui/"))) {
      errors.push("$.installedItems must reference Studio UI registry items");
    }
  }

  if (schemaTitle === "capabilityManifest") {
    const preserved = new Set(value.replacementCompatibility.mustPreserve);
    for (const invariant of ["policy", "audit", "evidence"]) {
      if (!preserved.has(invariant)) {
        errors.push(`$.replacementCompatibility.mustPreserve must include ${invariant}`);
      }
    }
  }

  if (schemaTitle === "primitiveManifest" && value.primitiveClass === "ui_reference") {
    if (!value.adapterCompatibility?.some((entry) => entry.includes("studio-ui"))) {
      errors.push("$.adapterCompatibility must name studio-ui for ui_reference primitives");
    }
  }

  if (schemaTitle === "evidencePacket") {
    if (value.redaction.containsSecrets && value.redaction.privatePayloadPolicy === "none") {
      errors.push("$.redaction.privatePayloadPolicy cannot be none when $.redaction.containsSecrets is true");
    }
    for (const [index, command] of value.commands.entries()) {
      if (command.status === "unavailable" && !command.unavailableReason) {
        errors.push(`$.commands[${index}].unavailableReason is required when status is unavailable`);
      }
      if (command.status !== "unavailable" && command.unavailableReason) {
        errors.push(`$.commands[${index}].unavailableReason is only allowed when status is unavailable`);
      }
    }
  }

  if (schemaTitle === "artifactRecord") {
    if (value.redaction.classification === "secret_adjacent" && value.redaction.privatePayloadPolicy === "none") {
      errors.push("$.redaction.privatePayloadPolicy cannot be none for secret-adjacent artifacts");
    }
  }

  if (schemaTitle === "traceEvent") {
    if (value.redaction.payloadPolicy === "none" && value.attributes && findSecretLookingPath(value.attributes, "$.attributes")) {
      errors.push("$.redaction.payloadPolicy cannot be none when trace attributes contain secret-looking fields");
    }
  }

  if (schemaTitle === "memoryRecord") {
    if (value.redaction.classification === "secret_adjacent" && value.redaction.mode === "none") {
      errors.push("$.redaction.mode cannot be none for secret-adjacent memory");
    }
    if (Date.parse(value.retention.forgetAfter) <= Date.parse(value.source.recordedAt)) {
      errors.push("$.retention.forgetAfter must be after $.source.recordedAt");
    }
  }

  if (schemaTitle === "contextPack") {
    const included = new Set(value.items.map((item) => item.sourceRef));
    for (const [index, droppedItem] of value.droppedItems.entries()) {
      if (included.has(droppedItem.sourceRef)) {
        errors.push(`$.droppedItems[${index}].sourceRef cannot also be included`);
      }
    }
  }

  if (schemaTitle === "toolExecution") {
    if (value.status !== "completed" && !value.error) {
      errors.push("$.error is required for denied, unsupported, timeout, cancelled, and failed tool executions");
    }
    if (value.status === "completed" && value.error) {
      errors.push("$.error is only allowed for non-completed tool executions");
    }
    if (["denied", "unsupported", "timeout", "cancelled", "failed"].includes(value.status) && value.redaction.resultPolicy === "none") {
      errors.push("$.redaction.resultPolicy cannot be none for non-completed tool executions");
    }
    if (value.status === "unsupported" && value.error?.code !== "adapter_unsupported") {
      errors.push("$.error.code must be adapter_unsupported for unsupported adapters");
    }
  }

  if (schemaTitle === "threatModelFixtureCatalog") {
    const risks = new Set(value.risks.map((risk) => risk.riskId));
    for (const [index, fixture] of value.fixtures.entries()) {
      if (!risks.has(fixture.riskId)) {
        errors.push(`$.fixtures[${index}].riskId must reference a catalog risk`);
      }
    }
  }

  return errors;
}

function findSecretLookingPath(value, path) {
  if (value === null || typeof value !== "object") return undefined;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (/secret|token|apiKey|credential|password|privatePayload/i.test(key)) {
      return childPath;
    }
    const nested = findSecretLookingPath(child, childPath);
    if (nested) return nested;
  }
  return undefined;
}

const generationCheck = spawnSync(process.execPath, [join(packageRoot, "scripts", "generate-contracts.mjs"), "--check"], {
  cwd: packageRoot,
  encoding: "utf8",
});
if (generationCheck.status !== 0) {
  failures.push((generationCheck.stderr || generationCheck.stdout || "contracts generated artifacts are out of date").trim());
}

for (const [title, file] of requiredAnchors) {
  const schema = readJson(join(schemaRoot, file));
  if (!schema) continue;
  if (schema.title !== title) {
    failures.push(`${file} must have title ${title}`);
  }
  if (!schema.$id?.startsWith("https://jami.studio/schemas/harness/")) {
    failures.push(`${file} must use the harness schema id namespace`);
  }
}

for (const fixtureFile of listJsonFiles(fixtureRoot)) {
  const fixture = readJson(fixtureFile);
  if (!fixture) continue;

  if (typeof fixture.$schema !== "string" || fixture.$schema.length === 0) {
    failures.push(`${relative(packageRoot, fixtureFile)} must declare $schema`);
    continue;
  }

  const schemaPath = normalize(resolve(dirname(fixtureFile), fixture.$schema ?? ""));
  if (!isWithin(normalize(schemaRoot), schemaPath)) {
    failures.push(`${relative(packageRoot, fixtureFile)} references schema outside packages/contracts/schemas`);
    continue;
  }

  const schema = readJson(schemaPath);
  if (!schema) continue;

  if (typeof fixture.expectedValid !== "boolean") {
    failures.push(`${relative(packageRoot, fixtureFile)} must declare expectedValid`);
    continue;
  }
  if (typeof fixture.caseId !== "string" || fixture.caseId.length === 0) {
    failures.push(`${relative(packageRoot, fixtureFile)} must declare caseId`);
    continue;
  }
  if (typeof fixture.description !== "string" || fixture.description.length === 0) {
    failures.push(`${relative(packageRoot, fixtureFile)} must declare description`);
    continue;
  }
  if (!("payload" in fixture)) {
    failures.push(`${relative(packageRoot, fixtureFile)} must declare payload`);
    continue;
  }

  fixtureCoverage.set(schema.title, (fixtureCoverage.get(schema.title) ?? 0) + 1);
  if (fixture.expectedValid === false) {
    negativeCaseCoverage.add(fixture.caseId);
  }

  const errors = [...validate(schema, fixture.payload), ...validateSemantics(schema.title, fixture.payload)];
  const valid = errors.length === 0;

  if (valid !== fixture.expectedValid) {
    failures.push(`${relative(packageRoot, fixtureFile)} expected valid=${fixture.expectedValid} but got valid=${valid}`);
    for (const error of errors) {
      failures.push(`  - ${error}`);
    }
  }
}

for (const title of requiredFixtureAnchors) {
  if (!fixtureCoverage.has(title)) {
    failures.push(`fixtures must include at least one case for ${title}`);
  }
}

for (const caseId of requiredNegativeCaseIds) {
  if (!negativeCaseCoverage.has(caseId)) {
    failures.push(`fixtures must include failing negative case ${caseId}`);
  }
}

if (failures.length > 0) {
  console.error("contracts validation failed");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("contracts validation passed");
