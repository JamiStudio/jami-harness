# Tool Gateway Foundation

Surface: `tools`, `contracts`, `sdk`, `cli`, `docs`

Added a narrow policy-gated tool gateway foundation with a replaceable registry, risk
labels, one execution envelope, typed `toolExecution` contract fixtures, trace/audit/
evidence/artifact output, timeout/cancellation status, and redaction for secret-like
inputs and results. Function tools are the only executable adapter in this pass.

MCP, OpenAPI, shell, browser, code, provider, and A2A adapters are explicit unsupported
capability manifests until repo-local source-lock evidence and adapter-specific fixtures
exist.
