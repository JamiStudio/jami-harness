# MCP Source Lock

Status: active source-lock evidence
Recorded: 2026-06-09
Owner: Jami Harness

## Locked Source

- Protocol: Model Context Protocol
- Spec version: `2025-11-25`
- Freshness: official docs mark `2025-11-25` as latest on 2026-06-09
- License/provenance: no vendored MCP source or SDK code is copied into this repo in this pass; the adapter is a dependency-free harness implementation against the public protocol pages listed below

Official source pages verified for this pass:

- `https://modelcontextprotocol.io/specification/2025-11-25`
- `https://modelcontextprotocol.io/specification/2025-11-25/basic/transports`
- `https://modelcontextprotocol.io/specification/2025-11-25/server/tools`
- `https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization`
- `https://modelcontextprotocol.io/specification/2025-11-25/changelog`

## Evidence Summary

- The current specification page identifies Version `2025-11-25` as latest.
- MCP uses JSON-RPC 2.0 and includes server tools as a core server feature.
- The standard transports are stdio and Streamable HTTP.
- Streamable HTTP requires invalid `Origin` headers to fail with HTTP 403, uses `MCP-Session-Id` for session-bound requests when sessions are issued, and requires `MCP-Protocol-Version` on subsequent HTTP requests.
- Tool names should be 1-128 characters and limited to ASCII letters, digits, underscore, hyphen, and dot.
- Tool annotations and descriptions are treated as untrusted unless they come from trusted servers.
- The `2025-11-25` changelog records changes since `2025-06-18`, including tool icons/metadata, tool-name guidance, Streamable HTTP Origin clarification, JSON Schema 2020-12 default dialect, and authorization discovery updates.

## Implemented In This Pass

- `packages/tools` locks `MCP_PROTOCOL_VERSION` to `2025-11-25`.
- The adapter supports only trusted in-process fixture discovery/call mapping for `initialize`, `tools/list`, and `tools/call`.
- MCP tool metadata is validated before registration and fails closed for unsupported protocol versions, invalid tool names, non-object input schemas, and policy-bypass or secret-exfiltration language.
- MCP tool calls execute through the existing policy-gated tool envelope and produce typed tool execution, audit, trace, artifact, and evidence records.
- Streamable HTTP guard validation is represented for invalid Origin, visible-ASCII session id, protocol version, and public localhost binding.

## Unsupported Or Not Claimed

- Remote OAuth, OpenID Connect discovery, Client ID Metadata Documents, dynamic client registration, PKCE, and access-token audience validation are not implemented.
- Stdio subprocess transport is not implemented.
- Streamable HTTP client/server transport, SSE polling, session lifecycle, DELETE session termination, resumability, and redelivery are not implemented.
- MCP resources, prompts, roots, sampling, elicitation, tasks, and tool-call support inside sampling are not implemented.
- This is not full MCP SDK parity.

## Refresh Triggers

- Any MCP implementation beyond trusted in-process tool fixtures.
- Any remote stdio or Streamable HTTP transport implementation.
- Any OAuth or authorization implementation.
- Any official MCP spec version newer than `2025-11-25`.
