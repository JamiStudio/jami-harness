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
- Read local observability metric records for run latency, estimated tokens,
  external-billable cost, and tool-call counts. The local deterministic provider records
  `0` external billable cost; it does not estimate hardware, labor, or hosted-provider
  spend.
- Inspect active module capabilities and missing optional surfaces.
- Inspect the tool gateway foundation: registry, policy-gated execution envelope,
  function adapter support, trusted MCP fixture support, unsupported adapter dry-run
  evidence, adapter manifests, and adapter source-lock state.
- Inspect the provider foundation: local deterministic workflow support, model
  replacement port, hosted-provider fail-closed behavior, and recovery fixture support.
- Inspect the full local source-checkout install path and modular BYO memory, context,
  search, store, provider, policy, tools, artifacts, observability, and docs-output paths.
- Inject replacement modules such as memory, context, search, checkpoint store, policy,
  provider, tools, artifacts, and observability without changing the run grammar.

Malformed run, artifact, and evidence identifiers fail before local artifacts or evidence
packets are written. Injected core modules must expose the methods their ports require.

This package does not implement OpenAI, Anthropic, Google, xAI, Azure OpenAI, Bedrock, or
other hosted provider execution. It also does not implement executable full
MCP/OpenAPI/shell/browser/code/provider-as-tool/A2A adapters beyond the current function
tool, trusted MCP fixture, and fail-closed adapter inspection foundations, durable hosted
stores, public package installation, SDK-level docs-output injection, release publishing,
or a hosted control plane. Repo-level docs generation exists through `pnpm docs:generate`
and is recorded in `docs/generated/install-readiness-manifest.json`.

```js
import { createHarness } from "@jami-studio/harness-sdk";

const harness = createHarness();
const result = await harness.run({ runId: "run_local_example" });

console.log(result.evidence.evidenceId);
```
