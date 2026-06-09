# Policy runtime spine

- Added policy, approval, audit, and secret-reference contract anchors with generated
  contract artifacts.
- Added policy hardening fixtures for prompt injection, tool metadata poisoning, MCP
  transport abuse, secret exfiltration, approval replay, denied action audit state, and
  secret-reference value leakage.
- Added `@jami-studio/harness-policy` with a default-deny policy engine, a policy-gated
  run helper, and root verification coverage.
