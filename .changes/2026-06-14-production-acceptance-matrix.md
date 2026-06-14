# Production Acceptance Matrix

Added command-backed production acceptance rows to the release capability manifest and
source-locked the current official MCP, shadcn registry, OpenAI Agents SDK, and OWASP LLM
security sources. `pnpm release:capabilities:check` now fails supported production-route
claims that lack a source-lock record, owner package, package-script gate, implementation
path, fixture/evidence path, evidence artifact, and support state.
