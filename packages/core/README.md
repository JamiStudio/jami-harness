# Jami Harness Core

`@jami-studio/harness-core` owns the default harness module composition seam. It wires
runtime, policy, tools, memory, context, search, artifacts, observability, checkpoint
stores, providers, and docs-output placeholders through stable ports, then exposes a
machine-readable inspection model for SDK, CLI, docs, workbench, and release evidence.

This package does not claim hosted providers, hosted stores, hosted workbench, Mintlify
publishing, hosted docs, hosted observability, or hosted control/runtime routes. Unsupported routes remain explicit
fail-closed capability states until their adapter packages and verification evidence exist.
