import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "AGENTS.md",
  "README.md",
  "docs/research/2026-06-07-agent-harness-production-feasibility-report.md",
  "docs/roadmaps/2026-06-07-agent-harness-production-plan.md",
  "docs/architecture/foundation-alignment.md",
  "docs/architecture/modular-responsibility-map.md",
  "docs/architecture/product-architecture.md",
  "docs/operations/changelog.md",
  "docs/operations/development-workflow.md",
  "docs/engineering/agents/goal.md",
  "docs/engineering/agents/orchestration-reliability.md",
  "docs/engineering/standards/report-style.md",
  "docs/engineering/standards/planning-style.md",
  "docs/engineering/standards/docs-standards.md",
  ".changes/README.md",
];

const bannedPlanningTerms = [
  /\bMVP\b/i,
  /\bprototype\b/i,
  /\bbeta\b/i,
  /\bv1\b/i,
  /\bv2\b/i,
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    failures.push(`missing required file: ${file}`);
  }
}

const docsToScan = requiredFiles.filter((file) => file.endsWith(".md"));
for (const file of docsToScan) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  const text = readFileSync(path, "utf8");
  for (const pattern of bannedPlanningTerms) {
    if (pattern.test(text)) {
      failures.push(`banned planning term ${pattern} found in ${file}`);
    }
  }
}

if (failures.length > 0) {
  console.error("docs:check failed");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("docs:check passed");
