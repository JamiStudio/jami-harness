#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createInMemoryMemoryPort } from "../../../packages/memory/src/index.mjs";
import { createHarness } from "../../../packages/sdk/src/index.mjs";

const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const generatorVersion = "2026-06-09.local-workbench";
const deterministicNow = "2026-06-09T12:00:00.000Z";
const runId = "run_workbench_local";
const args = parseArgs(process.argv.slice(2));

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const outputs = await generateWorkbench({ check: args.check, stateRoot: args.stateRoot });
  console.log(args.check ? "workbench:check passed" : `workbench:generate wrote ${outputs.length} files`);
}

export async function generateWorkbench(options = {}) {
  const model = await buildWorkbenchModel({ stateRoot: options.stateRoot });
  const outputs = buildOutputs(model);
  const changed = writeOrCheck(outputs, options.check === true);
  if (options.check === true && changed.length > 0) {
    console.error("workbench:check failed; generated outputs are stale:");
    for (const file of changed) console.error(`- ${file}`);
    process.exit(1);
  }
  return outputs;
}

export async function buildWorkbenchModel(options = {}) {
  const now = () => new Date(deterministicNow);
  const git = gitInfo();
  const sourceRecords = collectSourceRecords();
  const sourceInputHash = hashStable(sourceRecords.map(({ path, sha256 }) => ({ path, sha256 })));
  const docsSourceManifest = readJson("docs/generated/docs-source-manifest.json");
  const installReadiness = readJson("docs/generated/install-readiness-manifest.json");
  const releaseCapabilities = readJson("docs/generated/release-capability-manifest.json");
  const sbom = readJson("docs/generated/sbom.cdx.json");

  const memory = createInMemoryMemoryPort({ now });
  memory.write({
    memoryId: "mem_workbench_docs_source_manifest",
    runId,
    kind: "project",
    summary: `Docs source manifest accepts ${docsSourceManifest.acceptedSourceRecords?.length ?? 0} source records.`,
    content: `Generated docs source manifest input hash ${docsSourceManifest.sourceInputHash}; generated output paths ${(docsSourceManifest.generatedOutputPaths ?? []).join(", ")}.`,
    scope: {
      projectId: "proj_jami_harness",
      allowedActorIds: ["actor_developer"],
      allowedScopes: ["memory:read", "repo:read"],
    },
    source: {
      runId,
      artifactRef: "docs/generated/docs-source-manifest.json",
      recordedAt: deterministicNow,
    },
    freshness: {
      class: "deterministic_current_source_tree",
      asOf: deterministicNow,
    },
    retention: {
      policy: "project",
      forgetAfter: "2026-07-09T12:00:00.000Z",
    },
    citation: {
      citationId: "cit_workbench_docs_source_manifest",
      label: "docs/generated/docs-source-manifest.json",
      freshnessClass: "deterministic_current_source_tree",
    },
  });

  const harness = createHarness({ now, memory });
  const result = await harness.run({
    runId,
    sourceRepo: "jami-harness",
    sourceCommit: "git:HEAD",
    sourceRef: git.ref ?? "refs/heads/main",
    actor: {
      actorId: "actor_developer",
      scopes: ["repo:read", "tool:local:execute", "memory:read", "workbench:inspect"],
    },
    title: "Local workbench evidence run summary",
    subject: "Local workbench evidence shell input",
    commands: [
      { command: "node apps/workbench/scripts/generate-workbench.mjs --check", status: "passed", recordedAt: deterministicNow, evidenceRef: "ev_workbench_generate_check" },
      { command: "node apps/cli/src/cli.mjs inspect --json", status: "passed", recordedAt: deterministicNow, evidenceRef: "ev_workbench_cli_inspect" },
      { command: "pnpm docs:generate -- --check", status: "passed", recordedAt: deterministicNow, evidenceRef: "ev_workbench_docs_check" },
    ],
  });
  const approval = harness.approve({
    runId,
    actionId: "act_workbench_local_review",
    actorId: "actor_developer",
    scopes: ["workbench:inspect"],
    status: "approved",
  }).approval;
  const inspection = harness.inspect();
  const artifacts = harness.readArtifacts();

  return {
    schemaVersion: generatorVersion,
    sourceRepo: "jami-harness",
    sourceRemote: git.remote ?? "unknown",
    sourceCommit: "git:HEAD",
    sourceRef: git.ref ?? "unknown",
    sourceCommitResolutionCommand: "git rev-parse HEAD",
    sourceInputHash,
    generatedAt: "deterministic:local-workbench-source-tree",
    freshnessClass: "deterministic_current_source_tree",
    generator: {
      package: "@jami-studio/harness-workbench",
      version: generatorVersion,
      entrypoint: "apps/workbench/scripts/generate-workbench.mjs",
    },
    boundary: {
      mode: "local_static_workbench",
      hostedControlPlane: "unsupported_fail_closed",
      hostedWorkbench: "unsupported_fail_closed",
      studioUiPackageIntegration: "not_claimed",
      dataPolicy: "uses SDK runtime evidence, CLI state summaries when explicitly loaded, and generated docs manifests",
    },
    sourceRecords,
    commandEvidence: [
      "pnpm workbench:check",
      "pnpm workbench:test",
      "pnpm docs:generate -- --check",
      "node apps/cli/src/cli.mjs run --json",
    ],
    runtimeEvidence: {
      runId: result.runId,
      status: result.status,
      evidenceId: result.evidence.evidenceId,
      checkpoint: summarizeCheckpoint(result.checkpoint),
      provider: summarizeProvider(result.providerResult),
      tools: result.toolExecutions.map((entry) => summarizeToolExecution(entry.execution)),
    },
    views: {
      timeline: result.events.map(summarizeEvent),
      approvals: [approval],
      artifacts: artifacts.map(summarizeArtifact),
      traces: result.traces.map(summarizeTrace),
      metrics: result.metrics.map(summarizeMetric),
      memory: {
        records: memory.list().map(summarizeMemoryRecord),
        contextPack: summarizeContextPack(result.contextPack),
      },
      docsPreview: docsPreview(),
      systemMap: {
        mermaid: extractMermaid(readText("docs/generated/system-map.md")),
        packageNodes: packageNodes(),
        generatedPath: "docs/generated/system-map.md",
      },
      capabilities: {
        modules: inspection.modules,
        controlSurfaces: inspection.controlSurfaces,
        installPaths: installReadiness,
        releaseCapabilities: summarizeReleaseCapabilities(releaseCapabilities),
        sbom: {
          bomFormat: sbom.bomFormat,
          specVersion: sbom.specVersion,
          componentCount: Array.isArray(sbom.components) ? sbom.components.length : 0,
        },
        toolAdapters: inspection.toolAdapters,
        toolAdapterManifests: inspection.toolAdapterManifests,
      },
      localState: readCliState(options.stateRoot),
    },
    unavailable: [
      { surface: "Hosted control plane", status: "unsupported", reason: "No hosted runtime, account, deployment, or store is implemented in this repo." },
      { surface: "Hosted workbench", status: "unsupported", reason: "This pass emits a reusable local static shell only." },
      { surface: "Studio UI package integration", status: "not_claimed", reason: "No Studio UI package boundary is consumed by this workbench." },
      { surface: "Hosted stores", status: "unsupported", reason: "The workbench reads local SDK/CLI evidence and generated manifests only." },
      { surface: "Mintlify validation/build/publish", status: "unsupported", reason: "Mintlify remains source-locked but not installed or executed in this repo." },
    ],
  };
}

function buildOutputs(model) {
  return [
    out("apps/workbench/generated/workbench-manifest.json", `${JSON.stringify(model, null, 2)}\n`),
    out("apps/workbench/dist/index.html", html(model)),
  ];
}

function html(model) {
  const data = escapeHtml(JSON.stringify(model));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Jami Harness Local Workbench</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --ink: #1d2939;
      --muted: #667085;
      --line: #d0d5dd;
      --blue: #1f6feb;
      --green: #238636;
      --amber: #b7791f;
      --red: #c2410c;
      --violet: #6f42c1;
      --shadow: 0 1px 2px rgba(16, 24, 40, 0.08);
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--ink); }
    button, input, select, textarea { font: inherit; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 248px 1fr; }
    aside { border-right: 1px solid var(--line); background: #101828; color: #f9fafb; padding: 20px 14px; }
    .brand { display: grid; gap: 4px; padding: 0 6px 18px; }
    .brand strong { font-size: 18px; }
    .brand span { color: #cbd5e1; font-size: 12px; }
    nav { display: grid; gap: 6px; }
    .nav-button { border: 0; background: transparent; color: #d0d5dd; text-align: left; padding: 9px 10px; border-radius: 6px; cursor: pointer; }
    .nav-button:hover, .nav-button[aria-selected="true"] { background: #1d2939; color: #ffffff; }
    main { min-width: 0; padding: 22px; }
    .topbar { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 16px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 6px; letter-spacing: 0; }
    h2 { font-size: 16px; margin: 0 0 10px; letter-spacing: 0; }
    h3 { font-size: 14px; margin: 0 0 8px; color: var(--muted); letter-spacing: 0; }
    p { margin: 0; color: var(--muted); }
    code, pre { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
    .status-strip { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    .pill { display: inline-flex; align-items: center; min-height: 26px; padding: 4px 8px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel); color: var(--ink); font-size: 12px; white-space: nowrap; }
    .pill.good { color: var(--green); border-color: #b7e3c2; background: #f0fff4; }
    .pill.warn { color: var(--amber); border-color: #f4d58d; background: #fff8e1; }
    .pill.bad { color: var(--red); border-color: #f3b6a0; background: #fff3ed; }
    .grid { display: grid; gap: 12px; }
    .stats { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 12px; }
    .stat, .section { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow); }
    .stat { padding: 14px; min-height: 86px; }
    .stat .label { color: var(--muted); font-size: 12px; }
    .stat .value { font-size: 24px; font-weight: 650; margin-top: 6px; overflow-wrap: anywhere; }
    .section { padding: 14px; overflow: hidden; }
    .two { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 9px 8px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-weight: 600; background: #f9fafb; }
    tr:last-child td { border-bottom: 0; }
    .mono { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 12px; overflow-wrap: anywhere; }
    .scroll { overflow: auto; max-height: 460px; }
    .doc-preview, .map-preview { white-space: pre-wrap; font-size: 12px; line-height: 1.55; background: #0b1020; color: #e5e7eb; border-radius: 8px; padding: 12px; overflow: auto; max-height: 520px; }
    .empty { color: var(--muted); border: 1px dashed var(--line); border-radius: 8px; padding: 16px; background: #fbfcfd; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .tab-button { border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: 6px; padding: 7px 10px; cursor: pointer; }
    .tab-button[aria-selected="true"] { border-color: var(--blue); color: var(--blue); background: #f0f6ff; }
    @media (max-width: 920px) {
      .shell { grid-template-columns: 1fr; }
      aside { position: sticky; top: 0; z-index: 2; border-right: 0; border-bottom: 1px solid var(--line); }
      nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .stats, .two, .three { grid-template-columns: 1fr; }
      .topbar { display: grid; }
      .status-strip { justify-content: flex-start; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <div class="brand">
        <strong>Jami Harness</strong>
        <span>Local workbench from runtime evidence</span>
      </div>
      <nav id="nav"></nav>
    </aside>
    <main>
      <div class="topbar">
        <div>
          <h1 id="title">Overview</h1>
          <p id="subtitle"></p>
        </div>
        <div class="status-strip" id="status-strip"></div>
      </div>
      <section id="content"></section>
    </main>
  </div>
  <script id="workbench-data" type="application/json">${data}</script>
  <script>
    const data = JSON.parse(document.getElementById("workbench-data").textContent);
    const views = [
      ["overview", "Overview"],
      ["timeline", "Run Timeline"],
      ["approvals", "Approvals"],
      ["artifacts", "Artifacts"],
      ["traces", "Traces"],
      ["memory", "Memory"],
      ["control", "Control Surfaces"],
      ["docs", "Docs Preview"],
      ["map", "System Map"]
    ];
    const state = { view: "overview", doc: 0 };
    const nav = document.getElementById("nav");
    const content = document.getElementById("content");
    const title = document.getElementById("title");
    const subtitle = document.getElementById("subtitle");
    const statusStrip = document.getElementById("status-strip");

    for (const [id, label] of views) {
      const button = document.createElement("button");
      button.className = "nav-button";
      button.type = "button";
      button.textContent = label;
      button.setAttribute("aria-selected", id === state.view ? "true" : "false");
      button.addEventListener("click", () => { state.view = id; render(); });
      nav.append(button);
    }

    function render() {
      for (const button of nav.querySelectorAll("button")) {
        button.setAttribute("aria-selected", button.textContent === views.find(([id]) => id === state.view)[1] ? "true" : "false");
      }
      const current = views.find(([id]) => id === state.view);
      title.textContent = current[1];
      subtitle.textContent = data.boundary.dataPolicy;
      statusStrip.innerHTML = "";
      statusStrip.append(
        pill(data.runtimeEvidence.status, data.runtimeEvidence.status === "completed" ? "good" : "bad"),
        pill(data.boundary.mode, "good"),
        pill("hosted unsupported", "warn"),
        pill("Studio UI not claimed", "warn")
      );
      content.innerHTML = "";
      const renderer = {
        overview: renderOverview,
        timeline: () => renderTableSection("Timeline", data.views.timeline, ["sequence", "eventType", "status", "message"]),
        approvals: () => renderTableSection("Approval Records", data.views.approvals, ["approvalId", "runId", "actionId", "status", "actorId", "scopes"]),
        artifacts: () => renderTableSection("Artifacts", data.views.artifacts, ["artifactId", "kind", "title", "evidenceRef", "traceRef", "redaction"]),
        traces: () => renderTableSection("Traces", data.views.traces, ["traceId", "name", "kind", "status", "attributeKeys"]),
        memory: renderMemory,
        control: renderControl,
        docs: renderDocs,
        map: renderMap
      }[state.view];
      renderer();
    }

    function renderOverview() {
      content.append(stats([
        ["Run", data.runtimeEvidence.status],
        ["Artifacts", data.views.artifacts.length],
        ["Traces", data.views.traces.length],
        ["Docs", data.views.docsPreview.length]
      ]));
      const grid = div("grid two");
      grid.append(
        section("Provider", keyValue(data.runtimeEvidence.provider)),
        section("Unsupported Surfaces", table(data.unavailable, ["surface", "status", "reason"]))
      );
      content.append(grid);
      content.append(section("Tool Adapter State", table(data.views.capabilities.toolAdapters, ["adapterId", "support", "status", "reason"])));
    }

    function renderControl() {
      const supported = data.views.capabilities.controlSurfaces.filter((surface) => surface.status.includes("supported")).length;
      const failClosed = data.views.capabilities.controlSurfaces.filter((surface) => surface.status.includes("fail_closed")).length;
      content.append(stats([
        ["Local Surfaces", supported],
        ["Fail-Closed", failClosed],
        ["Release Posture", data.views.capabilities.controlSurfaces.find((surface) => surface.operation === "release")?.status],
        ["Workbench", data.boundary.hostedWorkbench]
      ]));
      content.append(section("SDK/CLI Control Surface Matrix", table(data.views.capabilities.controlSurfaces, ["operation", "status", "description"])));
    }

    function renderMemory() {
      content.append(stats([
        ["Memory Records", data.views.memory.records.length],
        ["Context Items", data.views.memory.contextPack.itemCount],
        ["Dropped Items", data.views.memory.contextPack.droppedItemCount],
        ["Context Hash", data.views.memory.contextPack.deterministicHash]
      ]));
      const grid = div("grid two");
      grid.append(
        section("Memory Records", table(data.views.memory.records, ["memoryId", "kind", "summary", "citationLabel", "freshnessClass"])),
        section("Context Pack", keyValue(data.views.memory.contextPack))
      );
      content.append(grid);
    }

    function renderDocs() {
      const toolbar = div("toolbar");
      data.views.docsPreview.forEach((doc, index) => {
        const button = document.createElement("button");
        button.className = "tab-button";
        button.type = "button";
        button.textContent = doc.title;
        button.setAttribute("aria-selected", String(index === state.doc));
        button.addEventListener("click", () => { state.doc = index; renderDocs(); });
        toolbar.append(button);
      });
      content.innerHTML = "";
      content.append(toolbar);
      const selected = data.views.docsPreview[state.doc] ?? data.views.docsPreview[0];
      content.append(section(selected.path, pre(selected.excerpt, "doc-preview")));
    }

    function renderMap() {
      const grid = div("grid two");
      grid.append(
        section("Generated System Map", pre(data.views.systemMap.mermaid, "map-preview")),
        section("Package Nodes", table(data.views.systemMap.packageNodes, ["name", "path", "description"]))
      );
      content.append(grid);
    }

    function renderTableSection(name, rows, columns) {
      content.append(section(name, rows.length ? table(rows, columns) : empty("No records in the current local manifest.")));
    }

    function stats(items) {
      const grid = div("grid stats");
      for (const [label, value] of items) {
        const item = div("stat");
        item.append(textEl("div", label, "label"), textEl("div", String(value ?? "none"), "value"));
        grid.append(item);
      }
      return grid;
    }

    function table(rows, columns) {
      const wrapper = div("scroll");
      const tableEl = document.createElement("table");
      const thead = document.createElement("thead");
      const tr = document.createElement("tr");
      columns.forEach((column) => tr.append(textEl("th", column)));
      thead.append(tr);
      tableEl.append(thead);
      const tbody = document.createElement("tbody");
      for (const row of rows) {
        const tr = document.createElement("tr");
        for (const column of columns) tr.append(cell(format(row?.[column])));
        tbody.append(tr);
      }
      tableEl.append(tbody);
      wrapper.append(tableEl);
      return wrapper;
    }

    function keyValue(value) {
      return table(Object.entries(value ?? {}).map(([key, val]) => ({ key, value: format(val) })), ["key", "value"]);
    }

    function section(heading, child) {
      const el = div("section");
      el.append(textEl("h2", heading));
      el.append(child);
      return el;
    }

    function cell(value) {
      const td = document.createElement("td");
      td.className = value.length > 36 ? "mono" : "";
      td.textContent = value;
      return td;
    }

    function pill(label, tone) {
      const el = document.createElement("span");
      el.className = "pill " + tone;
      el.textContent = label;
      return el;
    }

    function pre(value, className) {
      const el = document.createElement("pre");
      el.className = className;
      el.textContent = value ?? "";
      return el;
    }

    function empty(message) {
      return textEl("div", message, "empty");
    }

    function div(className) {
      const el = document.createElement("div");
      el.className = className;
      return el;
    }

    function textEl(tag, value, className = "") {
      const el = document.createElement(tag);
      if (className) el.className = className;
      el.textContent = value;
      return el;
    }

    function format(value) {
      if (Array.isArray(value)) return value.join(", ");
      if (value && typeof value === "object") return JSON.stringify(value);
      if (value === undefined || value === null || value === "") return "none";
      return String(value);
    }

    render();
  </script>
</body>
</html>
`;
}

function summarizeEvent(event, index) {
  return {
    sequence: event.sequence ?? index + 1,
    eventId: event.eventId,
    eventType: event.eventType,
    status: event.status ?? event.lifecycleState ?? "recorded",
    message: event.message ?? event.detail ?? event.error ?? "",
    recordedAt: event.recordedAt ?? event.timestamp,
  };
}

function summarizeCheckpoint(checkpoint) {
  return {
    checkpointId: checkpoint.checkpointId,
    runId: checkpoint.runId,
    status: checkpoint.status,
    sequence: checkpoint.sequence,
    replayHash: checkpoint.replayHash,
    redaction: checkpoint.redaction?.privatePayloadPolicy,
  };
}

function summarizeProvider(provider) {
  return {
    providerRunId: provider.providerRunId,
    providerId: provider.providerId,
    status: provider.status,
    reason: provider.reason,
    evidenceRef: provider.evidenceRef,
    toolCallCount: provider.toolCalls?.length ?? 0,
  };
}

function summarizeToolExecution(execution) {
  return {
    executionId: execution.executionId,
    toolId: execution.toolId,
    status: execution.status,
    evidenceRef: execution.evidenceRef,
    artifactRef: execution.artifactRef,
    startedAt: execution.startedAt,
    endedAt: execution.endedAt,
  };
}

function summarizeArtifact(artifact) {
  return {
    artifactId: artifact.artifactId,
    kind: artifact.kind,
    title: artifact.title,
    promotionState: artifact.promotionState,
    evidenceRef: artifact.provenance?.evidenceRef,
    traceRef: artifact.provenance?.traceRef,
    redaction: artifact.redaction?.privatePayloadPolicy,
    locator: artifact.storage?.locator,
  };
}

function summarizeTrace(trace) {
  return {
    traceId: trace.traceId,
    name: trace.name,
    kind: trace.kind,
    status: trace.status,
    runId: trace.runId,
    attributeKeys: Object.keys(trace.attributes ?? {}).sort(),
    redaction: trace.redaction?.payloadPolicy,
  };
}

function summarizeMetric(metric) {
  return {
    metricId: metric.metricId,
    name: metric.name,
    kind: metric.kind,
    value: metric.value,
    unit: metric.unit,
    source: metric.source,
  };
}

function summarizeMemoryRecord(record) {
  return {
    memoryId: record.memoryId,
    kind: record.kind,
    summary: record.summary,
    sourceRunId: record.source?.runId,
    artifactRef: record.source?.artifactRef,
    freshnessClass: record.freshness?.class,
    citationLabel: record.citation?.label,
    redaction: record.redaction?.mode,
  };
}

function summarizeContextPack(contextPack) {
  return {
    contextPackId: contextPack.contextPackId,
    runId: contextPack.runId,
    deterministicHash: contextPack.deterministicHash,
    itemCount: contextPack.items.length,
    droppedItemCount: contextPack.droppedItems.length,
    items: contextPack.items,
    droppedItems: contextPack.droppedItems,
  };
}

function docsPreview() {
  return [
    preview("Quickstart", "docs/generated/quickstart.md"),
    preview("User Manual", "docs/generated/user-manual.md"),
    preview("Evidence Index", "docs/generated/evidence-index.md"),
    preview("System Map", "docs/generated/system-map.md"),
  ];
}

function preview(title, path) {
  const text = readText(path);
  return {
    title,
    path,
    sha256: sha256(text),
    excerpt: text.split(/\r?\n/).slice(0, 48).join("\n"),
  };
}

function packageNodes() {
  return listPackageManifests().map((path) => {
    const manifest = readJson(path);
    return {
      name: manifest.name,
      path,
      description: manifest.description,
    };
  });
}

function summarizeReleaseCapabilities(manifest) {
  const unsupportedCapabilities = (manifest.capabilities ?? [])
    .filter((capability) => capability.status === "fail_closed_unsupported");
  return {
    schemaVersion: manifest.schemaVersion,
    sourceInputHash: manifest.sourceInputHash,
    unsupportedCount: unsupportedCapabilities.length,
    unsupportedSurfaces: unsupportedCapabilities.map((capability) => capability.surface),
  };
}

function readCliState(stateRoot) {
  if (!stateRoot) {
    return {
      status: "not_loaded",
      reason: "Pass --state-root <path-to-.jami-harness> to include live CLI run summaries.",
      runs: [],
      approvals: [],
    };
  }
  const root = resolve(stateRoot);
  const runsRoot = join(root, "runs");
  const approvalsRoot = join(root, "approvals");
  const runs = existsSync(runsRoot)
    ? readdirSync(runsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^run_[a-z0-9][a-z0-9_-]*$/.test(entry.name))
      .map((entry) => {
        const summaryPath = join(runsRoot, entry.name, "summary.json");
        const evidencePath = join(runsRoot, entry.name, "evidence.json");
        return {
          runId: entry.name,
          summary: existsSync(summaryPath) ? readJsonAbsolute(summaryPath) : undefined,
          evidence: existsSync(evidencePath) ? summarizeEvidence(readJsonAbsolute(evidencePath)) : undefined,
        };
      })
    : [];
  const approvals = existsSync(approvalsRoot)
    ? readdirSync(approvalsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^run_[a-z0-9][a-z0-9_-]*$/.test(entry.name))
      .flatMap((entry) => listJsonFiles(join(approvalsRoot, entry.name)))
    : [];
  return {
    status: existsSync(root) ? "loaded" : "missing",
    root,
    runs,
    approvals,
  };
}

function summarizeEvidence(evidence) {
  return {
    evidenceId: evidence.evidenceId,
    subject: evidence.subject,
    source: evidence.source,
    commandCount: evidence.commands?.length ?? 0,
    artifactCount: evidence.artifacts?.length ?? 0,
    redaction: evidence.redaction,
  };
}

function collectSourceRecords() {
  const files = [
    "package.json",
    "pnpm-workspace.yaml",
    "apps/cli/src/cli.mjs",
    "apps/cli/README.md",
    "apps/cli/test/cli.test.mjs",
    "apps/workbench/package.json",
    "apps/workbench/scripts/generate-workbench.mjs",
    "apps/workbench/test/workbench.test.mjs",
    "packages/sdk/src/index.mjs",
    "packages/sdk/README.md",
    "packages/sdk/test/sdk.test.mjs",
    "packages/store-local/src/index.mjs",
    "packages/observability/src/index.mjs",
    "packages/memory/src/index.mjs",
    "packages/docs/scripts/generate-docs.mjs",
    "packages/contracts/generated/reference.json",
    "docs/generated/docs-source-manifest.json",
    "docs/generated/install-readiness-manifest.json",
    "docs/generated/release-capability-manifest.json",
    "docs/generated/sbom.cdx.json",
    "docs/generated/quickstart.md",
    "docs/generated/user-manual.md",
    "docs/generated/evidence-index.md",
    "docs/generated/system-map.md",
  ];
  return files
    .filter((path) => existsSync(join(repoRoot, path)))
    .sort()
    .map((path) => {
      const text = readText(path);
      return { path, sha256: sha256(text), bytes: Buffer.byteLength(text) };
    });
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

function listJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^[a-z0-9_-]+\.json$/.test(entry.name))
    .map((entry) => readJsonAbsolute(join(dir, entry.name)));
}

function writeOrCheck(outputs, checkMode) {
  const changed = [];
  for (const output of outputs) {
    const full = join(repoRoot, output.path);
    const current = existsSync(full) ? readFileSync(full, "utf8") : undefined;
    if (current !== output.content) changed.push(output.path);
    if (!checkMode) {
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, output.content, "utf8");
    }
  }
  return changed;
}

function extractMermaid(markdown) {
  const match = markdown.match(/```mermaid\r?\n([\s\S]+?)```/);
  return match?.[1]?.trim() ?? "";
}

function parseArgs(argv) {
  const parsed = { check: false, stateRoot: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      parsed.check = true;
    } else if (arg === "--state-root") {
      parsed.stateRoot = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function out(path, content) {
  return { path, content };
}

function readText(path) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function readJsonAbsolute(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function gitInfo() {
  return {
    remote: runGit(["remote", "get-url", "origin"]),
    ref: runGit(["rev-parse", "--abbrev-ref", "HEAD"]),
  };
}

function runGit(gitArgs) {
  const result = spawnSync("git", gitArgs, { cwd: repoRoot, encoding: "utf8" });
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
