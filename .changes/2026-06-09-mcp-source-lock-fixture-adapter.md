# MCP source-lock and fixture adapter

Added repo-local MCP `2025-11-25` source-lock evidence and a narrow trusted in-process
MCP fixture adapter in `packages/tools`. The adapter maps `initialize`, `tools/list`, and
`tools/call` through the existing policy-gated tool envelope, rejects poisoned metadata
and unsupported protocol versions, and records unsupported stdio, Streamable HTTP,
OAuth, resources, prompts, roots, sampling, elicitation, tasks, and resumability in the
MCP capability manifest.
