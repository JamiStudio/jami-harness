# MCP Direct Registration Hardening

Tighten the tool gateway so `adapter_mcp` handlers execute only when produced by the
trusted in-process fixture discovery path. Direct MCP-shaped tool registrations now fail
closed as unsupported and still produce typed tool execution, trace, evidence, and
artifact records without invoking the handler.
