import test from "node:test";
import assert from "node:assert/strict";
import {
  createContextAssembler,
  createInMemoryMemoryPort,
  createMemorySearchAdapter,
  createNoopMemoryPort,
  createNoopSearchAdapter,
} from "../src/index.mjs";

const now = () => new Date("2026-06-09T12:00:00.000Z");

test("noop memory degrades explicitly for stateless runs", () => {
  const memory = createNoopMemoryPort();

  assert.equal(memory.write({}).written, false);
  assert.deepEqual(memory.search().items, []);
  assert.equal(memory.assembleContext({ runId: "run_stream4_foundation" }).items.length, 0);
});

test("in-memory search filters by actor, scope, project, retention, citation, and freshness", () => {
  const memory = createInMemoryMemoryPort({ now });
  memory.write({
    memoryId: "mem_allowed_note",
    kind: "project",
    projectId: "proj_jami_harness",
    runId: "run_stream4_foundation",
    summary: "Evidence packets are local and replaceable.",
    content: "The foundation is not a hosted observability backend.",
    scope: { projectId: "proj_jami_harness", allowedActorIds: ["actor_developer"], allowedScopes: ["memory:read"] },
  });
  memory.write({
    memoryId: "mem_other_actor",
    kind: "project",
    projectId: "proj_jami_harness",
    runId: "run_stream4_foundation",
    summary: "Private note",
    content: "Not visible to this actor.",
    scope: { projectId: "proj_jami_harness", allowedActorIds: ["actor_owner"], allowedScopes: ["memory:read"] },
  });

  const result = memory.search({
    text: "evidence",
    projectId: "proj_jami_harness",
    actor: { actorId: "actor_developer", scopes: ["memory:read"] },
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].record.memoryId, "mem_allowed_note");
  assert.equal(result.items[0].citation.freshnessClass, "current_run");
  assert.deepEqual(result.droppedItems, [{ sourceRef: "mem_other_actor", reason: "permission_denied" }]);
});

test("secret-adjacent memory is omitted by default and context packs are deterministic", () => {
  const memory = createInMemoryMemoryPort({ now });
  memory.write({
    memoryId: "mem_secret_note",
    kind: "project",
    projectId: "proj_jami_harness",
    runId: "run_stream4_foundation",
    summary: "token material",
    content: "token=do-not-recall",
    tokenValue: "do-not-store",
    scope: { projectId: "proj_jami_harness", allowedActorIds: ["actor_developer"], allowedScopes: ["memory:read"] },
  });

  const packA = memory.assembleContext({
    runId: "run_stream4_foundation",
    projectId: "proj_jami_harness",
    actor: { actorId: "actor_developer", scopes: ["memory:read"] },
  });
  const packB = memory.assembleContext({
    runId: "run_stream4_foundation",
    projectId: "proj_jami_harness",
    actor: { actorId: "actor_developer", scopes: ["memory:read"] },
  });

  assert.equal(memory.list()[0].redaction.mode, "omitted");
  assert.equal(memory.list()[0].content, undefined);
  assert.equal(packA.deterministicHash, packB.deterministicHash);
});

test("replaceable search and context adapters preserve permissions, citations, and token budget drops", () => {
  const memory = createInMemoryMemoryPort({ now });
  memory.write({
    memoryId: "mem_context_allowed",
    kind: "project",
    projectId: "proj_jami_harness",
    runId: "run_context_adapter",
    summary: "short context",
    content: "Allowed context source.",
    scope: { projectId: "proj_jami_harness", allowedActorIds: ["actor_developer"], allowedScopes: ["memory:read"] },
  });
  memory.write({
    memoryId: "mem_context_long",
    kind: "project",
    projectId: "proj_jami_harness",
    runId: "run_context_adapter",
    summary: "long context ".repeat(80),
    content: "Large context source.",
    scope: { projectId: "proj_jami_harness", allowedActorIds: ["actor_developer"], allowedScopes: ["memory:read"] },
  });
  memory.write({
    memoryId: "mem_context_other_actor",
    kind: "project",
    projectId: "proj_jami_harness",
    runId: "run_context_adapter",
    summary: "leak attempt",
    content: "Should not cross actor boundary.",
    scope: { projectId: "proj_jami_harness", allowedActorIds: ["actor_owner"], allowedScopes: ["memory:read"] },
  });

  const assembler = createContextAssembler({
    search: createMemorySearchAdapter(memory),
    tokenBudget: 20,
  });
  const pack = assembler.assemble({
    runId: "run_context_adapter",
    projectId: "proj_jami_harness",
    actor: { actorId: "actor_developer", scopes: ["memory:read"] },
  });
  const packWithClockFunction = assembler.assemble({
    runId: "run_context_adapter",
    projectId: "proj_jami_harness",
    actor: { actorId: "actor_developer", scopes: ["memory:read"] },
    now,
  });

  assert.equal(pack.items.length, 1);
  assert.equal(packWithClockFunction.items.length, 1);
  assert.equal(packWithClockFunction.assembledAt, "2026-06-09T12:00:00.000Z");
  assert.equal(pack.items[0].sourceRef, "mem_context_allowed");
  assert.equal(pack.items[0].citationId, "cit_context_adapter_project");
  assert.equal(pack.droppedItems.some((item) => item.reason === "permission_denied"), true);
  assert.equal(pack.droppedItems.some((item) => item.reason === "token_budget_exceeded"), true);
});

test("noop search adapter degrades explicitly for context assembly", () => {
  const assembler = createContextAssembler({ search: createNoopSearchAdapter(), tokenBudget: 10 });
  const pack = assembler.assemble({ runId: "run_noop_context" });

  assert.equal(pack.items.length, 0);
  assert.match(pack.deterministicHash, /^sha256:/);
});
