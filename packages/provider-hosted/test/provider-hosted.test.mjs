import test from "node:test";
import assert from "node:assert/strict";
import {
  createHostedProviderRouter,
  createOpenAIHostedProvider,
  readOpenAIConfig,
} from "../src/index.mjs";

const now = () => new Date("2026-06-13T12:00:00.000Z");

test("hosted OpenAI provider fails closed without auth and does not call network", async () => {
  let called = false;
  const provider = createOpenAIHostedProvider({
    now,
    env: { JAMI_HARNESS_OPENAI_MODEL: "gpt-test" },
    fetchFn: async () => {
      called = true;
      throw new Error("network should not be called");
    },
  });
  const result = await provider.generate({ runId: "run_openai_auth_missing", providerId: "provider_openai" });

  assert.equal(result.status, "auth_missing");
  assert.equal(result.executable, false);
  assert.equal(called, false);
  assert.equal(result.redaction.secretRefs.includes("env:JAMI_HARNESS_OPENAI_API_KEY"), true);
  assert.equal(JSON.stringify(result).includes("sk-test"), false);
});

test("hosted OpenAI provider fails closed when model source is missing", async () => {
  let called = false;
  const provider = createOpenAIHostedProvider({
    now,
    env: { JAMI_HARNESS_OPENAI_API_KEY: "sk-test-secret" },
    fetchFn: async () => {
      called = true;
      throw new Error("network should not be called");
    },
  });
  const result = await provider.generate({ runId: "run_openai_source_missing", providerId: "provider_openai" });

  assert.equal(result.status, "source_missing");
  assert.equal(called, false);
  assert.equal(JSON.stringify(result).includes("sk-test-secret"), false);
});

test("hosted OpenAI provider rejects malformed provider id and request before network", async () => {
  let called = false;
  const provider = createOpenAIHostedProvider({
    now,
    env: {
      JAMI_HARNESS_OPENAI_API_KEY: "sk-test-secret",
      JAMI_HARNESS_OPENAI_MODEL: "gpt-test",
    },
    fetchFn: async () => {
      called = true;
      throw new Error("network should not be called");
    },
  });
  const badProvider = await provider.generate({ runId: "run_openai_bad_provider", providerId: "../provider" });
  const badInstruction = await provider.generate({ runId: "run_openai_bad_request", providerId: "provider_openai", instruction: { text: "bad" } });

  assert.equal(badProvider.status, "malformed");
  assert.equal(badInstruction.status, "malformed");
  assert.equal(called, false);
});

test("hosted provider router preserves local deterministic success path", async () => {
  const provider = createHostedProviderRouter({ now, env: {} });
  const result = await provider.generate({ runId: "run_router_local", instruction: "local evidence" });

  assert.equal(result.status, "completed");
  assert.equal(result.providerId, "provider_local_deterministic");
  assert.equal(result.toolCalls[0].toolId, "tool_local_echo");
});

test("hosted provider router returns unsupported for unknown hosted provider", async () => {
  const provider = createHostedProviderRouter({ now, env: {} });
  const result = await provider.generate({ runId: "run_router_unsupported", providerId: "provider_anthropic" });

  assert.equal(result.status, "unsupported");
  assert.equal(result.output.structured.failClosed, true);
});

test("hosted OpenAI provider executes deterministic mocked Responses API success", async () => {
  const requests = [];
  const provider = createOpenAIHostedProvider({
    now,
    env: {
      JAMI_HARNESS_OPENAI_API_KEY: "sk-test-secret",
      JAMI_HARNESS_OPENAI_MODEL: "gpt-test",
      JAMI_HARNESS_OPENAI_BASE_URL: "https://api.openai.test/v1",
    },
    fetchFn: async (url, init) => {
      requests.push({ url, init });
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            id: "resp_test",
            model: "gpt-test",
            output_text: "hosted adapter response",
            usage: { input_tokens: 5, output_tokens: 7, total_tokens: 12 },
          };
        },
      };
    },
  });
  const result = await provider.generate({
    runId: "run_openai_success",
    providerId: "provider_openai",
    instruction: "produce hosted evidence",
  });

  assert.equal(result.status, "completed");
  assert.equal(result.output.text, "hosted adapter response");
  assert.equal(result.usage.totalTokens, 12);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.openai.test/v1/responses");
  assert.equal(requests[0].init.headers.authorization, "Bearer sk-test-secret");
  assert.equal(JSON.stringify(result).includes("sk-test-secret"), false);
});

test("OpenAI config reads only Jami Harness hosted provider env names", () => {
  const config = readOpenAIConfig({
    OPENAI_API_KEY: "sk-ambient",
    JAMI_HARNESS_OPENAI_MODEL: "gpt-test",
  });

  assert.equal(config.credential, undefined);
  assert.equal(config.model, "gpt-test");
  assert.equal(config.redacted.apiKeyRef, "env:JAMI_HARNESS_OPENAI_API_KEY");
});
