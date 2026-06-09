#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = new Set(process.argv.slice(2));
const check = args.has("--check");
const json = args.has("--json");
const outputPath = "docs/generated/sbom.cdx.json";
const outputFullPath = join(repoRoot, outputPath);
const specVersion = "1.7";
const generatedAt = git(["log", "-1", "--format=%cI"]) ?? "unknown";
const sourceCommit = git(["rev-parse", "HEAD"]) ?? "working-tree";
const sourceRef = git(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "unknown";
const sourceRemote = git(["remote", "get-url", "origin"]) ?? "unknown";
const packageFiles = discoverPackageFiles();
const packages = packageFiles.map((path) => ({
  path,
  manifest: JSON.parse(readFileSync(join(repoRoot, path), "utf8")),
}));
const sourceInputHash = hashJson(packages.map(({ path, manifest }) => ({
  path,
  name: manifest.name,
  version: manifest.version,
  private: manifest.private === true,
  license: manifest.license,
  repository: manifest.repository,
  dependencies: manifest.dependencies ?? {},
  devDependencies: manifest.devDependencies ?? {},
  peerDependencies: manifest.peerDependencies ?? {},
  optionalDependencies: manifest.optionalDependencies ?? {},
})));

const bom = {
  bomFormat: "CycloneDX",
  specVersion,
  serialNumber: `urn:uuid:${deterministicUuid(`${sourceCommit}:${sourceInputHash}`)}`,
  version: 1,
  metadata: {
    timestamp: generatedAt,
    tools: {
      components: [{
        type: "application",
        name: "@jami-studio/harness-sbom-local-generator",
        version: "2026-06-09",
        description: "Dependency-free local package-manifest SBOM generator for Jami Harness release dry-runs.",
      }],
    },
    component: componentFor(packages.find((entry) => entry.path === "package.json"), true),
    properties: [
      property("jami:harness:sourceRepo", "jami-harness"),
      property("jami:harness:sourceRemote", sourceRemote),
      property("jami:harness:sourceCommit", sourceCommit),
      property("jami:harness:sourceRef", sourceRef),
      property("jami:harness:sourceInputHash", sourceInputHash),
      property("jami:harness:commands", "pnpm sbom:generate; pnpm sbom:check"),
      property("jami:harness:commandResult", "passed"),
      property("jami:harness:freshnessClass", "current-head"),
      property("jami:harness:publishClaim", "none"),
      property("jami:harness:attestationClaim", "none"),
    ],
  },
  components: packages
    .filter((entry) => entry.path !== "package.json")
    .map((entry) => componentFor(entry, false)),
  dependencies: packages.map((entry) => ({
    ref: bomRefFor(entry.manifest.name, entry.path),
    dependsOn: workspaceDependenciesFor(entry.manifest),
  })),
};

if (check) {
  if (!existsSync(outputFullPath)) {
    fail(`${outputPath} is missing; run pnpm sbom:generate`);
  }
  const existing = readFileSync(outputFullPath, "utf8");
  const expected = `${JSON.stringify(bom, null, 2)}\n`;
  if (existing !== expected) {
    fail(`${outputPath} is out of date; run pnpm sbom:generate`);
  }
  report({ status: "passed", outputPath, packageCount: packages.length, sourceInputHash });
} else {
  mkdirSync(dirname(outputFullPath), { recursive: true });
  writeFileSync(outputFullPath, `${JSON.stringify(bom, null, 2)}\n`);
  report({ status: "written", outputPath, packageCount: packages.length, sourceInputHash });
}

function discoverPackageFiles() {
  const files = ["package.json"];
  for (const base of ["packages", "apps"]) {
    const basePath = join(repoRoot, base);
    if (!existsSync(basePath)) continue;
    const entries = spawnSync("git", ["ls-files", `${base}/*/package.json`], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    if (entries.status !== 0) continue;
    for (const file of entries.stdout.split(/\r?\n/).filter(Boolean)) {
      files.push(file);
    }
  }
  return [...new Set(files)].sort();
}

function componentFor(entry, root) {
  const manifest = entry.manifest;
  const component = {
    type: "application",
    "bom-ref": bomRefFor(manifest.name, entry.path),
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    licenses: [{ license: { id: manifest.license } }],
    purl: packageUrlFor(manifest.name, manifest.version),
    properties: [
      property("jami:harness:manifestPath", entry.path),
      property("jami:harness:private", String(manifest.private === true)),
      property("jami:harness:repository", manifest.repository?.url ?? "unknown"),
    ],
  };
  if (root) {
    component.properties.push(property("jami:harness:rootPackage", "true"));
  }
  if (manifest.repository?.directory) {
    component.properties.push(property("jami:harness:repositoryDirectory", manifest.repository.directory));
  }
  return component;
}

function workspaceDependenciesFor(manifest) {
  const names = new Set(packages.map((entry) => entry.manifest.name));
  const dependencyMaps = [
    manifest.dependencies ?? {},
    manifest.devDependencies ?? {},
    manifest.peerDependencies ?? {},
    manifest.optionalDependencies ?? {},
  ];
  const refs = [];
  for (const dependencyMap of dependencyMaps) {
    for (const name of Object.keys(dependencyMap)) {
      if (names.has(name)) {
        const entry = packages.find((candidate) => candidate.manifest.name === name);
        refs.push(bomRefFor(name, entry.path));
      }
    }
  }
  return [...new Set(refs)].sort();
}

function packageUrlFor(name, version) {
  const encoded = name.startsWith("@")
    ? `%40${name.slice(1)}`
    : name;
  return `pkg:npm/${encoded}@${version}`;
}

function bomRefFor(name, path) {
  return `pkg:${name}:${path}`.replace(/[^A-Za-z0-9_.:@/-]+/g, "_");
}

function property(name, value) {
  return { name, value };
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function deterministicUuid(input) {
  const hex = createHash("sha256").update(input).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${(parseInt(hex.slice(16, 18), 16) & 0x3f | 0x80).toString(16).padStart(2, "0")}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function report(payload) {
  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`sbom:${payload.status} ${payload.outputPath} packages=${payload.packageCount} sourceInputHash=${payload.sourceInputHash}\n`);
  }
}

function fail(message) {
  process.stderr.write(`sbom:failed ${message}\n`);
  process.exit(2);
}
