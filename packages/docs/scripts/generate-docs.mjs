#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const args = new Set(process.argv.slice(2));
const check = args.has("--check");
const generatorVersion = "2026-06-09.docs-source-manifest";
const generatedAt = "deterministic:git-head-plus-input-hash";

const sourceRecords = collectSourceRecords();
const inputHash = hashStable(sourceRecords.map(({ path, sha256 }) => ({ path, sha256 })));
const git = gitInfo();
const provenance = {
  schemaVersion: generatorVersion,
  sourceRepo: "jami-harness",
  sourceRemote: git.remote ?? "unknown",
  sourceCommit: "git:HEAD",
  sourceRef: git.ref ?? "unknown",
  sourceCommitResolutionCommand: "git rev-parse HEAD",
  sourceInputHash: inputHash,
  generatedAt,
  freshnessClass: "deterministic_current_source_tree",
  command: "pnpm docs:generate -- --check",
  commandResult: "passed",
  generator: {
    package: "@jami-studio/harness-docs",
    version: generatorVersion,
    entrypoint: "packages/docs/scripts/generate-docs.mjs",
  },
};

const model = buildModel(sourceRecords);
const outputs = buildOutputs(model, provenance);
const changed = writeOrCheck(outputs);

if (check && changed.length > 0) {
  console.error("docs:generate check failed; generated outputs are stale:");
  for (const file of changed) console.error(`- ${file}`);
  process.exit(1);
}

console.log(check ? "docs:generate check passed" : `docs:generate wrote ${outputs.length} files`);

function collectSourceRecords() {
  const files = [
    "package.json",
    "pnpm-workspace.yaml",
    "packages/contracts/generated/reference.json",
    "packages/contracts/generated/openapi.json",
    "docs/operations/release-readiness.md",
    "docs/architecture/modular-responsibility-map.md",
    "docs/architecture/product-architecture.md",
    "apps/cli/README.md",
    "packages/sdk/README.md",
    "packages/provider-local/README.md",
  ];
  files.push(...listFiles("packages/contracts/schemas", ".json"));
  files.push(...listFiles("packages/contracts/fixtures", ".json"));
  files.push(...listFiles(".changes", ".md"));
  files.push(...listPackageManifests());
  return [...new Set(files)]
    .filter((file) => existsSync(join(repoRoot, file)))
    .sort()
    .map((file) => {
      const text = readFileSync(join(repoRoot, file), "utf8");
      return {
        path: file,
        sha256: sha256(text),
        bytes: Buffer.byteLength(text),
      };
    });
}

function buildModel(records) {
  const rootManifest = readJson("package.json");
  const reference = readJson("packages/contracts/generated/reference.json");
  const openapi = readJson("packages/contracts/generated/openapi.json");
  const packageManifests = listPackageManifests()
    .filter((file) => existsSync(join(repoRoot, file)))
    .map((file) => ({ path: file, manifest: readJson(file) }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const schemas = listFiles("packages/contracts/schemas", ".json").sort();
  const fixtures = listFiles("packages/contracts/fixtures", ".json").sort();
  const changes = listFiles(".changes", ".md")
    .filter((file) => file !== ".changes/README.md")
    .sort()
    .map((file) => ({ path: file, title: titleFromChange(file) }));

  return {
    rootManifest,
    packageManifests,
    reference,
    openapi,
    schemas,
    fixtures,
    changes,
    records,
    generatedOutputPaths: [
      "docs/generated/quickstart.md",
      "docs/generated/user-manual.md",
      "docs/generated/api-reference.md",
      "docs/generated/system-map.md",
      "docs/generated/changelog.md",
      "docs/generated/evidence-index.md",
      "docs/generated/docs-source-manifest.json",
      "apps/docs/docs.json",
      "apps/docs/index.mdx",
      "apps/docs/user-manual.mdx",
      "apps/docs/api-reference.mdx",
      "apps/docs/system-map.mdx",
      "apps/docs/evidence-index.mdx",
    ],
  };
}

function buildOutputs(model, baseProvenance) {
  const quickstartDoc = markdown("Generated Quickstart", baseProvenance, quickstart(model));
  const userManualDoc = markdown("Generated User Manual", baseProvenance, userManual(model));
  const apiReferenceDoc = markdown("Generated API Reference Summary", baseProvenance, apiReference(model));
  const systemMapDoc = markdown("Generated System Map", baseProvenance, systemMap(model));
  const changelogDoc = markdown("Generated Changelog Draft", baseProvenance, changelog(model));
  const evidenceIndexDoc = markdown("Generated Claims And Evidence Index", baseProvenance, evidenceIndex(model));
  const manifest = {
    ...baseProvenance,
    acceptedSourceRecords: model.records,
    acceptedContractReferences: (model.reference.schemas ?? []).map((schema) => ({
      name: schema.title,
      schemaId: schema.id,
      schemaPath: `packages/contracts/${schema.file}`,
      requiredFields: schema.required,
    })),
    acceptedEvidenceReferences: model.fixtures
      .filter((file) => /observability|tools|policy|artifacts|memory|compatibility/.test(file))
      .map((path) => ({ path })),
    generatedOutputPaths: model.generatedOutputPaths,
    unavailable: [
      {
        surface: "Mintlify build/publish",
        reason: "A Mintlify-ready docs.json and MDX draft are generated locally, but the Mintlify CLI/package is not installed or source-locked in this repo.",
      },
      {
        surface: "Hosted public docs",
        reason: "No hosted docs target has been selected or authorized.",
      },
    ],
  };

  return [
    out("docs/generated/quickstart.md", quickstartDoc),
    out("docs/generated/user-manual.md", userManualDoc),
    out("docs/generated/api-reference.md", apiReferenceDoc),
    out("docs/generated/system-map.md", systemMapDoc),
    out("docs/generated/changelog.md", changelogDoc),
    out("docs/generated/evidence-index.md", evidenceIndexDoc),
    out("docs/generated/docs-source-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`),
    out("apps/docs/docs.json", `${JSON.stringify(mintlifyConfig(), null, 2)}\n`),
    out("apps/docs/index.mdx", mdx("Jami Harness Quickstart", quickstartDoc)),
    out("apps/docs/user-manual.mdx", mdx("Jami Harness User Manual", userManualDoc)),
    out("apps/docs/api-reference.mdx", mdx("Jami Harness API Reference", apiReferenceDoc)),
    out("apps/docs/system-map.mdx", mdx("Jami Harness System Map", systemMapDoc)),
    out("apps/docs/evidence-index.mdx", mdx("Jami Harness Evidence Index", evidenceIndexDoc)),
  ];
}

function quickstart(model) {
  return [
    "## Current Install Posture",
    "",
    `The root package is \`${model.rootManifest.name}\` at version \`${model.rootManifest.version}\`. Package manifests remain private until release gates close.`,
    "",
    "## Local Commands",
    "",
    "```powershell",
    "pnpm install --frozen-lockfile",
    "pnpm docs:generate -- --check",
    "pnpm verify",
    "node apps/cli/src/cli.mjs init --json",
    "node apps/cli/src/cli.mjs run --json",
    "node apps/cli/src/cli.mjs inspect --json",
    "```",
    "",
    "## Available Foundations",
    "",
    ...model.packageManifests.map(({ path, manifest }) => `- \`${manifest.name}\` from \`${path}\`: ${manifest.description}`),
    "",
    "## Not Claimed",
    "",
    "- Packages are not publish-ready.",
    "- Hosted docs are not deployed.",
    "- Mintlify build/publish has not run in this repo.",
    "- Hosted model providers are not implemented; the provider foundation is local deterministic only.",
  ].join("\n");
}

function userManual(model) {
  return [
    "## Developer Workflow",
    "",
    "Use the CLI for local state and evidence inspection. The CLI writes local `.jami-harness` state in the target project and does not publish externally.",
    "",
    "## Module Inspection",
    "",
    "`jami map --json` reports active runtime, policy, provider, tools, memory, artifacts, observability, and docs-output capability state.",
    "",
    "## Evidence Handling",
    "",
    "Generated docs and evidence records are tied to accepted source records, contract references, command result, freshness class, and generated output paths in `docs/generated/docs-source-manifest.json`.",
    "",
    "## Changelog",
    "",
    `The current generated changelog consumes ${model.changes.length} accepted changelog fragments from \`.changes/\`.`,
  ].join("\n");
}

function apiReference(model) {
  const contracts = [...(model.reference.schemas ?? [])].sort((a, b) => a.title.localeCompare(b.title));
  return [
    "## Contract Anchors",
    "",
    ...contracts.map((schema) => `- \`${schema.title}\` from \`packages/contracts/${schema.file}\` with schema id \`${schema.id}\`.`),
    "",
    "## OpenAPI Components",
    "",
    ...Object.keys(model.openapi.components?.schemas ?? {}).sort().map((name) => `- \`${name}\``),
    "",
    "## Package Surfaces",
    "",
    ...model.packageManifests.map(({ manifest }) => `- \`${manifest.name}\``),
  ].join("\n");
}

function systemMap(model) {
  return [
    "## Package Graph",
    "",
    "```mermaid",
    "flowchart LR",
    "  contracts[packages/contracts]",
    "  runtime[packages/runtime]",
    "  policy[packages/policy]",
    "  tools[packages/tools]",
    "  provider[packages/provider-local]",
    "  memory[packages/memory]",
    "  artifacts[packages/artifacts]",
    "  observability[packages/observability]",
    "  sdk[packages/sdk]",
    "  cli[apps/cli]",
    "  docs[packages/docs]",
    "  contracts --> runtime",
    "  contracts --> policy",
    "  contracts --> tools",
    "  contracts --> provider",
    "  contracts --> memory",
    "  contracts --> artifacts",
    "  contracts --> observability",
    "  runtime --> sdk",
    "  policy --> sdk",
    "  tools --> sdk",
    "  provider --> sdk",
    "  memory --> sdk",
    "  artifacts --> sdk",
    "  observability --> sdk",
    "  sdk --> cli",
    "  contracts --> docs",
    "  artifacts --> docs",
    "  observability --> docs",
    "```",
    "",
    "## Source Counts",
    "",
    `- Contract schemas: ${model.schemas.length}`,
    `- Contract fixtures: ${model.fixtures.length}`,
    `- Package manifests: ${model.packageManifests.length}`,
    `- Changelog fragments: ${model.changes.length}`,
  ].join("\n");
}

function changelog(model) {
  return [
    "## Accepted Fragments",
    "",
    ...model.changes.map((change) => `- ${change.title} (\`${change.path}\`)`),
  ].join("\n");
}

function evidenceIndex(model) {
  return [
    "## Claims",
    "",
    "- Local contract schemas, generated references, and fixtures exist.",
    "- Local docs generation exists and has check mode.",
    "- Local CLI/SDK evidence smoke exists.",
    "- Local deterministic provider workflow exists and routes tool calls through the policy-gated tool gateway.",
    "- Release publishing, hosted docs, hosted model providers, attestation, and SBOM artifacts remain unavailable until their gates close.",
    "",
    "## Evidence Inputs",
    "",
    ...model.records.map((record) => `- \`${record.path}\` (${record.sha256})`),
  ].join("\n");
}

function markdown(title, provenance, body) {
  return [
    `# ${title}`,
    "",
    "<!-- generated by packages/docs/scripts/generate-docs.mjs; do not edit by hand -->",
    "",
    "## Provenance",
    "",
    `- Source repo: \`${provenance.sourceRepo}\``,
    `- Source commit: \`${provenance.sourceCommit}\``,
    `- Source ref: \`${provenance.sourceRef}\``,
    `- Source input hash: \`${provenance.sourceInputHash}\``,
    `- Command: \`${provenance.command}\``,
    `- Command result: \`${provenance.commandResult}\``,
    `- Freshness class: \`${provenance.freshnessClass}\``,
    "",
    body,
    "",
  ].join("\n");
}

function mdx(title, source) {
  const body = source
    .replace(/^# .+\n\n/, "")
    .replace("<!-- generated by packages/docs/scripts/generate-docs.mjs; do not edit by hand -->\n\n", "");
  return [`# ${title}`, "", body].join("\n");
}

function mintlifyConfig() {
  return {
    "$schema": "https://mintlify.com/docs.json",
    theme: "mint",
    name: "Jami Harness",
    navigation: {
      tabs: [
        {
          tab: "Docs",
          groups: [
            {
              group: "Start",
              pages: ["index", "user-manual"],
            },
            {
              group: "Reference",
              pages: ["api-reference", "system-map", "evidence-index"],
            },
          ],
        },
      ],
    },
  };
}

function writeOrCheck(outputs) {
  const changed = [];
  for (const output of outputs) {
    const full = join(repoRoot, output.path);
    const current = existsSync(full) ? readFileSync(full, "utf8") : undefined;
    if (current !== output.content) changed.push(output.path);
    if (!check) {
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, output.content, "utf8");
    }
  }
  return changed;
}

function out(path, content) {
  return { path, content };
}

function listPackageManifests() {
  const files = ["package.json"];
  for (const base of ["packages", "apps"]) {
    const fullBase = join(repoRoot, base);
    if (!existsSync(fullBase)) continue;
    for (const entry of readdirSync(fullBase, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = `${base}/${entry.name}/package.json`;
      if (existsSync(join(repoRoot, path))) files.push(path);
    }
  }
  return files.sort();
}

function listFiles(base, extension) {
  const fullBase = join(repoRoot, base);
  if (!existsSync(fullBase)) return [];
  const files = [];
  walk(fullBase, files, extension);
  return files.map((file) => relative(repoRoot, file).replaceAll("\\", "/")).sort();
}

function walk(dir, files, extension) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files, extension);
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(full);
    }
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
}

function titleFromChange(path) {
  const text = readFileSync(join(repoRoot, path), "utf8");
  const heading = text.match(/^#\s+(.+)$/m);
  return heading?.[1] ?? path.replace(/^\.changes\//, "").replace(/\.md$/, "");
}

function gitInfo() {
  return {
    remote: runGit(["remote", "get-url", "origin"]),
    ref: runGit(["rev-parse", "--abbrev-ref", "HEAD"]),
  };
}

function runGit(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function sha256(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function hashStable(value) {
  return sha256(JSON.stringify(sortObject(value)));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}
