# @jami-studio/harness-provider-hosted

Fail-closed hosted provider adapter foundation for Jami Harness.

The package currently ships the first executable hosted adapter contract for
`provider_openai`. Live execution requires an explicit provider request plus
`JAMI_HARNESS_OPENAI_API_KEY` and `JAMI_HARNESS_OPENAI_MODEL` in the supplied
environment. Optional `JAMI_HARNESS_OPENAI_BASE_URL` may override the default OpenAI API
base URL.

Without those explicit values, the adapter returns typed `auth_missing` or
`source_missing` results and emits redacted provider evidence. The deterministic local
provider remains the default local behavior.
