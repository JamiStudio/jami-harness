## Group C SDK/CLI/workbench surface integration

- Added SDK inspection for the local control-surface matrix across run/resume/approve/deny/cancel/retry/inspect/tools/memory/context/docs/map/workbench/release/doctor/verify/migration.
- Added CLI JSON surfaces for deny, cancel, retry, context, workbench, release, and migration while keeping cancellation, manual retry orchestration, and migrations fail-closed unsupported.
- Extended the local workbench manifest to render the SDK/CLI control-surface matrix from generated evidence.
- Hardened unsupported cancel/retry/migration CLI routes so they do not initialize local state when reporting fail-closed gaps.
