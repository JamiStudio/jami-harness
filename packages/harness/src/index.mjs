export { createHarness, HarnessInputError } from "@jami-studio/harness-sdk";
export { HarnessCoreError, composeHarnessCore } from "@jami-studio/harness-core";
export { createRunLifecycleKernel } from "@jami-studio/harness-runtime";
export { createDefaultPolicyEngine, createPolicyGatedRunKernel } from "@jami-studio/harness-policy";
export {
  createToolGateway,
  createToolRegistry,
  createFunctionTool,
  listToolAdapterCapabilities,
  listToolAdapterSourceLocks,
} from "@jami-studio/harness-tools";
export {
  createContextAssembler,
  createInMemoryMemoryPort,
  createMemorySearchAdapter,
  createNoopMemoryPort,
  createNoopSearchAdapter,
} from "@jami-studio/harness-memory";
export { createFileSystemCheckpointStore, createInMemoryCheckpointStore } from "@jami-studio/harness-store-local";
export { createDeterministicProvider, createUnsupportedExternalProvider, validateProviderRoute } from "@jami-studio/harness-provider-local";
export { createInMemoryArtifactStore, toArtifactView } from "@jami-studio/harness-artifacts";
export {
  createRunObservability,
  resolveTelemetryGate,
  withTelemetry,
  createNoopTelemetrySink,
  createPostHogTelemetrySink,
} from "@jami-studio/harness-observability";

export const HARNESS_PACKAGE = {
  name: "@jami-studio/harness",
  version: "0.1.1",
  packageClass: "batteries-included-entrypoint",
  hostedRuntimeIncluded: false,
};
