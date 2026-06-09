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
    "apps/cli/src/cli.mjs",
    "apps/cli/test/cli.test.mjs",
    "apps/cli/README.md",
    "packages/sdk/src/index.mjs",
    "packages/sdk/test/sdk.test.mjs",
    "packages/tools/README.md",
    "packages/sdk/README.md",
    "packages/provider-local/README.md",
    "packages/observability/README.md",
    "packages/observability/src/index.mjs",
    "packages/observability/test/observability.test.mjs",
    "evals/smoke.mjs",
    "packages/docs/scripts/generate-docs.mjs",
    "scripts/release/check-readiness.mjs",
    "scripts/release/generate-capability-manifest.mjs",
    "docs/operations/release-capability-source-lock.md",
    "docs/generated/release-capability-manifest.json",
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
      "docs/generated/install-readiness-manifest.json",
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
  const installManifest = installReadinessManifest(model, baseProvenance);
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
      {
        surface: "Public package installation",
        reason: "All package manifests remain private:true, so generated install guidance is limited to the local source-checkout path.",
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
    out("docs/generated/install-readiness-manifest.json", `${JSON.stringify(installManifest, null, 2)}\n`),
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
    "pnpm eval:smoke",
    "pnpm verify",
    "node apps/cli/src/cli.mjs init --json",
    "node apps/cli/src/cli.mjs run --json",
    "node apps/cli/src/cli.mjs inspect --json",
    "```",
    "",
    "## Full Local Harness Path",
    "",
    "The supported install path today is a local source checkout. Public package installation remains unavailable because package manifests are still private.",
    "",
    "```powershell",
    ...installReadinessManifest(model, {}).fullLocalHarness.installCommands,
    "```",
    "",
    "## Modular Replacement Paths",
    "",
    installPathTable(model),
    "",
    "The same evidence is emitted as structured JSON in `docs/generated/install-readiness-manifest.json` and through SDK/CLI inspection.",
    "",
    "## Available Foundations",
    "",
    ...model.packageManifests.map(({ path, manifest }) => `- \`${manifest.name}\` from \`${path}\`: ${manifest.description}`),
    "",
    "## Not Claimed",
    "",
    "- Packages are not publish-ready.",
    "- Hosted docs are not deployed.",
    "- Mintlify validation/build/publish has not run in this repo.",
    "- Hosted model providers are not implemented; the provider foundation is local deterministic only.",
    "- Hosted observability and external eval backends are not implemented; eval smoke is local deterministic only.",
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
    "## Full Harness And Modular Paths",
    "",
    "Use the full local source-checkout path when you want the complete current foundation. Use SDK module injection when you need to bring your own memory, context, search, checkpoint store, provider, policy engine, tools, artifact store, observability sink, or docs-output path.",
    "",
    installPathTable(model),
    "",
    "The docs-output path is intentionally split: repo-level generation is supported through `pnpm docs:generate`, while SDK docs-output injection remains unavailable.",
    "",
    "## Evidence Handling",
    "",
    "Generated docs and evidence records are tied to accepted source records, contract references, command result, freshness class, and generated output paths in `docs/generated/docs-source-manifest.json`.",
    "",
    "`docs/generated/release-capability-manifest.json` is the executable local release/hosted capability ledger. It keeps unsupported publish, provenance, attestation, Mintlify validation, hosted docs, hosted provider, hosted store, and hosted workbench claims fail-closed until command evidence exists.",
    "",
    "Local metric records and `pnpm eval:smoke` provide deterministic regression coverage for tool safety, docs generation, memory recall, and recovery without a hosted observability or external eval backend.",
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
    "  evals[evals/smoke.mjs]",
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
    "  observability --> evals",
    "  tools --> evals",
    "  memory --> evals",
    "  docs --> evals",
    "  sdk --> cli",
    "  install[docs/generated/install-readiness-manifest.json]",
    "  install --> sdk",
    "  install --> cli",
    "  install --> docs",
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
    "- Full local source-checkout install and modular replacement paths are recorded in a generated install-readiness manifest.",
    "- Release and hosted capability readiness is recorded in a generated manifest with official-source prerequisites and fail-closed unsupported states.",
    "- Local deterministic provider workflow exists and routes tool calls through the policy-gated tool gateway.",
    "- Local redacted metric records exist for latency, token-estimate, external-billable-cost, and tool-call measurements.",
    "- Local deterministic regression eval smoke exists for tool safety, docs generation, memory recall, and recovery.",
    "- Tool adapter source inspection exists for supported function and trusted MCP fixture paths plus fail-closed OpenAPI, shell, browser, code, provider-as-tool, and A2A dry-run evidence.",
    "- Release and hosted capability readiness is generated into `docs/generated/release-capability-manifest.json`, with unsupported npm publish/provenance, package contents dry-runs, GitHub attestations, Mintlify validation/publishing, hosted docs, hosted providers, hosted stores, and hosted workbench surfaces marked fail-closed.",
    "- Release publishing, hosted docs, hosted model providers, executable full protocol/local tool adapters, attestation, and package release artifacts remain unavailable until their gates close.",
    "",
    "## Evidence Inputs",
    "",
    ...model.records.map((record) => `- \`${record.path}\` (${record.sha256})`),
  ].join("\n");
}

function installReadinessManifest(model, provenance) {
  return {
    ...provenance,
    schemaVersion: "2026-06-09.install-readiness",
    sourceRepo: "jami-harness",
    fullLocalHarness: {
      pathId: "full_local_source_checkout",
      status: "supported_local_source_checkout",
      packageInstallStatus: "unavailable_private_manifests",
      installCommands: [
        "pnpm install --frozen-lockfile",
        "node apps/cli/src/cli.mjs init --json",
        "node apps/cli/src/cli.mjs run --json",
        "node apps/cli/src/cli.mjs inspect --json",
      ],
      evidenceCommands: [
        "pnpm sdk:test",
        "pnpm cli:test",
        "pnpm docs:generate -- --check",
        "pnpm eval:smoke",
        "pnpm release:readiness",
      ],
      sourceEvidence: [
        "packages/sdk/src/index.mjs",
        "apps/cli/src/cli.mjs",
        "packages/docs/scripts/generate-docs.mjs",
        "evals/smoke.mjs",
        "docs/operations/release-readiness.md",
      ],
      unavailableReasons: [
        "Package manifests remain private:true.",
        "Hosted providers, hosted stores, hosted workbench, release publishing, Mintlify build/publish, hosted public docs, and attestations remain unavailable.",
      ],
    },
    modularPaths: installPathRecords(model),
    unsupportedSurfaces: [
      "public npm install",
      "hosted provider runtime",
      "hosted durable stores",
      "hosted workbench",
      "release publishing",
      "Mintlify build/publish",
      "hosted public docs",
      "release attestations",
    ],
  };
}

function installPathRecords(model) {
  return [
    installPathRecord(model, {
      pathId: "byo_memory",
      module: "memory",
      sdkOption: "memory",
      defaultPackage: "@jami-studio/harness-memory",
      status: "supported_port",
      commandEvidence: ["pnpm sdk:test", "jami map --json"],
      notes: "Use no-op, local, or user-owned memory modules while preserving citation, freshness, scope, and replay metadata.",
    }),
    installPathRecord(model, {
      pathId: "byo_context",
      module: "context",
      sdkOption: "context",
      defaultPackage: "@jami-studio/harness-memory",
      status: "supported_port",
      commandEvidence: ["pnpm sdk:test", "jami map --json"],
      notes: "Replace context assembly without changing run grammar; context packs preserve inclusion reasons and deterministic hashes.",
    }),
    installPathRecord(model, {
      pathId: "byo_search",
      module: "search",
      sdkOption: "search",
      defaultPackage: "@jami-studio/harness-memory",
      status: "supported_port",
      commandEvidence: ["pnpm sdk:test", "jami map --json"],
      notes: "Use the no-op or memory-backed adapter today; hosted/vector search remains unavailable.",
    }),
    installPathRecord(model, {
      pathId: "byo_store",
      module: "checkpointStore",
      sdkOption: "checkpointStore",
      defaultPackage: "@jami-studio/harness-store-local",
      status: "supported_port",
      commandEvidence: ["pnpm sdk:test", "pnpm cli:test", "jami doctor --json"],
      notes: "Use in-memory or filesystem checkpoint stores today; hosted stores remain unavailable.",
    }),
    installPathRecord(model, {
      pathId: "byo_provider",
      module: "provider",
      sdkOption: "provider",
      defaultPackage: "@jami-studio/harness-provider-local",
      status: "supported_port_local_only",
      commandEvidence: ["pnpm provider:test", "pnpm sdk:test", "pnpm cli:test"],
      notes: "The local deterministic provider is supported; hosted providers fail closed until source-lock, auth, redaction, policy, trace, and adapter fixtures land.",
    }),
    installPathRecord(model, {
      pathId: "byo_policy",
      module: "policy",
      sdkOption: "policyEngine",
      defaultPackage: "@jami-studio/harness-policy",
      status: "supported_port",
      commandEvidence: ["pnpm policy:test", "pnpm sdk:test"],
      notes: "Replace the policy engine behind the harness seam without weakening default-deny and audit evidence requirements.",
    }),
    installPathRecord(model, {
      pathId: "byo_tools",
      module: "tools",
      sdkOption: "tools",
      defaultPackage: "@jami-studio/harness-tools",
      status: "supported_port_current_adapters_only",
      commandEvidence: ["pnpm tools:test", "pnpm sdk:test", "jami tools --json"],
      notes: "Function tools and trusted MCP fixtures are supported; OpenAPI, shell, browser, code, provider-as-tool, A2A, stdio MCP, and remote MCP remain fail-closed unsupported surfaces.",
    }),
    installPathRecord(model, {
      pathId: "byo_artifacts",
      module: "artifacts",
      sdkOption: "artifactStore",
      defaultPackage: "@jami-studio/harness-artifacts",
      status: "supported_port",
      commandEvidence: ["pnpm artifacts:test", "pnpm sdk:test"],
      notes: "Replace artifact storage while preserving provenance, evidence refs, and artifact view projection.",
    }),
    installPathRecord(model, {
      pathId: "byo_observability",
      module: "observability",
      sdkOption: "observability",
      defaultPackage: "@jami-studio/harness-observability",
      status: "supported_port",
      commandEvidence: ["pnpm observability:test", "pnpm sdk:test"],
      notes: "Replace trace/audit/evidence sinks while preserving redaction and evidence packet shape.",
    }),
    installPathRecord(model, {
      pathId: "byo_docs_output",
      module: "docsOutput",
      sdkOption: "docsOutput",
      defaultPackage: "@jami-studio/harness-docs",
      status: "repo_generator_supported_sdk_output_unavailable",
      commandEvidence: ["pnpm docs:generate -- --check"],
      notes: "Repo-level docs generation is supported; SDK docs-output injection and hosted docs publishing remain unavailable.",
    }),
  ];
}

function installPathRecord(model, { pathId, module, sdkOption, defaultPackage, status, commandEvidence, notes }) {
  return {
    pathId,
    module,
    sdkOption,
    defaultPackage,
    packageManifest: packagePath(model, defaultPackage),
    status,
    commandEvidence,
    inspection: `harness.inspect().installPaths.modularPaths[pathId=${pathId}]`,
    notes,
  };
}

function installPathTable(model) {
  const rows = installPathRecords(model).map((path) => (
    `| \`${path.pathId}\` | \`${path.sdkOption}\` | \`${path.status}\` | ${path.notes} |`
  ));
  return [
    "| Path | SDK option | Current status | Evidence boundary |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function packagePath(model, packageName) {
  return model.packageManifests.find(({ manifest }) => manifest.name === packageName)?.path;
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
