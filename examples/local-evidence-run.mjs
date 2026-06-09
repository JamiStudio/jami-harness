import { createHarness } from "../packages/sdk/src/index.mjs";

const harness = createHarness();
const result = await harness.run({
  runId: "run_example_local",
  sourceRepo: "jami-harness",
  sourceCommit: "working-tree",
  sourceRef: "refs/heads/main",
  commands: [{ command: "node examples/local-evidence-run.mjs", status: "passed", recordedAt: new Date().toISOString() }],
});

console.log(JSON.stringify({
  runId: result.runId,
  status: result.status,
  evidenceId: result.evidence.evidenceId,
  artifactId: result.artifact.artifactId,
  traceCount: result.traces.length,
}, null, 2));
