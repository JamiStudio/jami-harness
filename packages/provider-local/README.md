# Harness Local Provider

Status: local deterministic foundation

`@jami-studio/harness-provider-local` owns the first replaceable model-provider port
implementation. It is a deterministic local adapter for workflow and recovery fixtures,
not hosted model support.

Current capabilities:

- `provider_local_deterministic` emits typed workflow output and local tool-call intent.
- Provider calls use `harness.provider.model` as the replacement port.
- Hosted provider ids such as `provider_openai`, `provider_anthropic`, and
  `provider_google` fail closed as typed unsupported results.
- Fail-once mode records recoverable provider failure before retrying deterministically.
- Capability manifests declare unsupported streaming, hosted models, and provider auth.

The adapter never reads provider API keys, OAuth credentials, or cloud account state. Any
future OpenAI, Anthropic, Google, xAI, Azure OpenAI, Bedrock, or other hosted provider
adapter needs repo-local source-lock evidence, auth controls, policy fixtures, trace and
redaction coverage, and unsupported negative tests before support can be claimed.

## Verification

Run:

```sh
pnpm provider:test
```

The root `pnpm verify` command includes `provider:test`.
