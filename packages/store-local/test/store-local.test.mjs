import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  HarnessStoreError,
  createFileSystemCheckpointStore,
  createInMemoryCheckpointStore,
} from "../src/index.mjs";

const now = () => new Date("2026-06-09T12:00:00.000Z");

test("in-memory checkpoint store writes resumable redacted checkpoints with replay hashes", () => {
  const store = createInMemoryCheckpointStore({ now });
  const result = store.writeCheckpoint({
    runId: "run_store_fixture",
    status: "awaiting_approval",
    events: [{ eventType: "tool.call.requested", userPrompt: "do not keep this" }],
    pendingApprovals: [{ actionId: "act_publish", tokenValue: "secret-token" }],
  });

  assert.equal(result.written, true);
  assert.equal(result.checkpoint.status, "awaiting_approval");
  assert.match(result.checkpoint.replayHash, /^sha256:/);
  assert.equal(result.checkpoint.events[0].userPrompt, "[redacted]");
  assert.equal(store.resume("run_store_fixture").resumable, true);
});

test("filesystem checkpoint store persists checkpoints and approvals without path traversal", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jami-store-"));
  try {
    const store = createFileSystemCheckpointStore({ now, root: join(cwd, ".jami-harness") });
    const checkpoint = store.writeCheckpoint({
      runId: "run_fs_fixture",
      status: "awaiting_approval",
      events: [{ eventType: "run.progress" }],
    }).checkpoint;
    const approval = store.writeApproval({
      runId: "run_fs_fixture",
      actionId: "act_publish_release",
      scopes: ["release:publish"],
    }).approval;

    const stored = JSON.parse(await readFile(join(cwd, ".jami-harness", "checkpoints", "run_fs_fixture.json"), "utf8"));
    assert.equal(stored.replayHash, checkpoint.replayHash);
    assert.equal(store.listApprovals("run_fs_fixture")[0].approvalId, approval.approvalId);
    assert.throws(
      () => store.readCheckpoint("../outside"),
      (error) => error instanceof HarnessStoreError && error.code === "invalid_identifier",
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("approval records reject malformed ids, statuses, and replay-unsafe expiry windows", () => {
  const store = createInMemoryCheckpointStore({ now });

  assert.throws(
    () => store.writeApproval({ runId: "run_approval_fixture", actionId: "../bad" }),
    (error) => error instanceof HarnessStoreError && error.code === "invalid_identifier",
  );
  assert.throws(
    () => store.writeApproval({ runId: "run_approval_fixture", actionId: "act_publish", actorId: "owner" }),
    (error) => error instanceof HarnessStoreError && error.code === "invalid_identifier",
  );
  assert.throws(
    () => store.writeApproval({ runId: "run_approval_fixture", actionId: "act_publish", approvalId: "../apr_escape" }),
    (error) => error instanceof HarnessStoreError && error.code === "invalid_identifier",
  );
  assert.throws(
    () => store.writeApproval({ runId: "run_approval_fixture", actionId: "act_publish", evidenceRef: "secret://approval" }),
    (error) => error instanceof HarnessStoreError && error.code === "invalid_identifier",
  );
  assert.throws(
    () => store.writeApproval({ runId: "run_approval_fixture", actionId: "act_publish", status: "maybe" }),
    (error) => error instanceof HarnessStoreError && error.code === "invalid_approval_status",
  );
  assert.throws(
    () => store.writeApproval({ runId: "run_approval_fixture", actionId: "act_publish", approvedAt: "not-a-date" }),
    (error) => error instanceof HarnessStoreError && error.code === "invalid_timestamp",
  );
  assert.throws(
    () => store.writeApproval({
      runId: "run_approval_fixture",
      actionId: "act_publish",
      approvedAt: "2026-06-09T12:00:00.000Z",
      expiresAt: "2026-06-09T12:00:00.000Z",
    }),
    (error) => error instanceof HarnessStoreError && error.code === "invalid_approval_expiry",
  );
});
