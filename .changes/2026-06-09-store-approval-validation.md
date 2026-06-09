## Store Approval Validation Hardening

- Hardened local approval records so store-level callers must use stable `apr_*`,
  `act_*`, and `actor_*` identifiers instead of relying on silent normalization.
- Added negative coverage for malformed approval identifiers, unsupported approval
  statuses, and replay-unsafe expiry windows.
