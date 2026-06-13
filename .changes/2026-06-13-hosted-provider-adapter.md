## Provider

- Added a fail-closed hosted provider adapter package with an OpenAI Responses API route
  that only executes when explicit Jami Harness env vars are configured.
- Routed default provider execution through local deterministic plus hosted provider
  selection while preserving deterministic local behavior.
