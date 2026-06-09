import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
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
]);

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

  const schemaPath = normalize(resolve(dirname(fixtureFile), fixture.$schema ?? ""));
  if (!schemaPath.startsWith(normalize(schemaRoot))) {
    failures.push(`${relative(packageRoot, fixtureFile)} references schema outside packages/contracts/schemas`);
    continue;
  }

  const schema = readJson(schemaPath);
  if (!schema) continue;

  if (typeof fixture.expectedValid !== "boolean") {
    failures.push(`${relative(packageRoot, fixtureFile)} must declare expectedValid`);
    continue;
  }

  const errors = validate(schema, fixture.payload);
  const valid = errors.length === 0;

  if (valid !== fixture.expectedValid) {
    failures.push(`${relative(packageRoot, fixtureFile)} expected valid=${fixture.expectedValid} but got valid=${valid}`);
    for (const error of errors) {
      failures.push(`  - ${error}`);
    }
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
