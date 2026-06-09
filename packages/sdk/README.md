# Jami Harness SDK Foundation

Status: local foundation

`@jami-studio/harness-sdk` composes the current dependency-light runtime, policy,
tool registry, artifact, observability, and memory packages into one developer API.

Current capabilities:

- Create a local run through the existing runtime lifecycle kernel.
- Export local evidence packets from runtime events, traces, and artifact records.
- Read artifact records and trace records from the default local stores.
- Inspect active module capabilities and missing optional surfaces.
- Inspect the tool gateway foundation: registry, policy-gated execution envelope,
  function adapter support, and unsupported adapter manifests.
- Inject replacement modules such as memory, policy, artifacts, and observability without
  changing the run grammar.

Malformed run, artifact, and evidence identifiers fail before local artifacts or evidence
packets are written. Injected core modules must expose the methods their ports require.

This package does not implement provider execution, MCP/OpenAPI/shell/browser/code/A2A
adapters, durable hosted stores, SDK-level docs-output injection, release publishing, or
a hosted control plane. Repo-level docs generation exists through `pnpm docs:generate`.

```js
import { createHarness } from "@jami-studio/harness-sdk";

const harness = createHarness();
const result = await harness.run({ runId: "run_local_example" });

console.log(result.evidence.evidenceId);
```
