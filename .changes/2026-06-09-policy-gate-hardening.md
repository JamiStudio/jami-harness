# Policy gate hardening

- Hardened the policy runtime so malformed action requests fail closed with typed
  `run_unknown`, `actor_unknown`, `proj_unknown`, `unknown` environment, and
  `unknown` risk denial evidence instead of producing contract-invalid audit records.
- Added regression coverage for malformed policy requests and regenerated contract
  artifacts for the closed-state evidence sentinels.
