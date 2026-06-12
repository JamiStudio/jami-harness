# Core Composition Package

Added `@jami-studio/harness-core` as the owned default composition package for runtime,
policy, tools, memory, context, search, artifacts, observability, stores, providers, and
docs-output ports. The SDK now consumes this core seam instead of owning module assembly
directly, and `pnpm verify` runs the new core test gate.
