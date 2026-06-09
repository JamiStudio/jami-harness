# Jami Harness SDK Foundation

Status: local foundation

`@jami-studio/harness-sdk` composes the current dependency-light runtime, policy,
local deterministic provider, tool gateway, artifact, observability, memory, context,
search, and checkpoint store packages into one developer API.

Current capabilities:

- Create a local run through the existing runtime lifecycle kernel.
- Export local evidence packets from runtime events, traces, and artifact records.
- Run a local deterministic provider workflow that requests a registered local tool
  through the policy-gated tool gateway.
- Write redacted run checkpoints with replay hashes through a replaceable checkpoint
  store port.
- Resume from stored checkpoint state and record local approval evidence.
- Read artifact records and trace records from the default local stores.
- Inspect active module capabilities and missing optional surfaces.
- Inspect the tool gateway foundation: registry, policy-gated execution envelope,
  function adapter support, and unsupported adapter manifests.
- Inspect the provider foundation: local deterministic workflow support, model
  replacement port, hosted-provider fail-closed behavior, and recovery fixture support.
- Inject replacement modules such as memory, context, search, checkpoint store, policy,
  provider, tools, artifacts, and observability without changing the run grammar.

Malformed run, artifact, and evidence identifiers fail before local artifacts or evidence
packets are written. Injected core modules must expose the methods their ports require.

This package does not implement OpenAI, Anthropic, Google, xAI, Azure OpenAI, Bedrock, or
other hosted provider execution. It also does not implement MCP/OpenAPI/shell/browser/code/A2A
adapters beyond the current tool gateway foundations, durable hosted stores, SDK-level
docs-output injection, release publishing, or a hosted control plane. Repo-level docs
generation exists through `pnpm docs:generate`.

```js
import { createHarness } from "@jami-studio/harness-sdk";

const harness = createHarness();
const result = await harness.run({ runId: "run_local_example" });

console.log(result.evidence.evidenceId);
```
