import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

// Planning is canonical in `_ops`, not in this product repo, per the family
// source-of-truth policy (`_ops/docs/source-of-truth-policy.md`): cross-repo
// "planning, roadmaps, decisions, research" live under
// `_ops/projects/<project>/planning/`. The harness feasibility report and
// production plan were relocated to
// `_ops/projects/jami-harness/planning/{research,roadmaps}/`, so this gate no
// longer requires in-repo copies (and must not, or it would force their
// recreation against policy). Durable architecture/operations/standards/agent
// docs remain canonical in-repo and are still required below.
const requiredFiles = [
  "AGENTS.md",
  "README.md",
  "docs/architecture/foundation-alignment.md",
  "docs/architecture/modular-responsibility-map.md",
  "docs/architecture/product-architecture.md",
  "docs/operations/changelog.md",
  "docs/operations/development-workflow.md",
  "docs/operations/release-readiness.md",
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
