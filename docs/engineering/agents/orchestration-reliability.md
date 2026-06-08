# Orchestration Reliability

Use this guidance when a goal run coordinates work through agents, subagents, local processes, or long-running implementation streams in Jami Agent Harness.

## Failure Mode

Coordinator sessions can stop while waiting on long-running workers. If the only orchestration state lives in the coordinator context, the project loses progress evidence and the next agent has to rediscover intent.

Treat this as a workflow reliability risk. Do not solve it by avoiding agents; solve it by making every run resumable from repo state.

## Coordinator Rules

- Do not use one long wait call as the only coordination point.
- Poll workers in short intervals, normally 60-120 seconds.
- Keep polling until every dispatched worker has a terminal result, is explicitly closed, or is replaced by a checkpointed dispatch.
- Do not send a final handoff while a checkpointed worker is still running unless the user explicitly pauses the run.
- After every dispatch, write a compact checkpoint into the active roadmap:
  - worker id or process id when available
  - workstream and pass
  - ownership boundary
  - dispatch timestamp
  - expected verification
  - next coordinator action
- After every returned result, update the checkpoint with:
  - status
  - changed files
  - verification
  - unresolved blockers
  - next pass needed
- If a wait call does not return, resume from roadmap checkpoints and visible filesystem/Git state, not from memory.
- Never leave the only source of orchestration state inside chat.

## Harness-Specific Additions

- Subagents execute; orchestrators assess, dispatch, checkpoint, and gate.
- Foundational streams should run at least two fresh-context passes before closeout unless the change is documentation-only and fully read back.
- Do not run two workers on the same workstream at the same time.
- Serialize work that mutates shared contracts, schema, migrations, policy language, or generated docs.
- GPU/local model/sandbox/browser resources should be serialized unless the roadmap proves isolation.
- Do not treat timed-out verification as success. Record it as unknown and either rerun or dispatch a verifier.
- Generated artifacts must point back to the canonical source that produced them.
- Docs, changelogs, system maps, user guides, and marketing claims are outputs of the canon, not independent truth.

## Practical Loop

1. Read the active roadmap and current checkpoints.
2. Dispatch one worker or execute one bounded task.
3. Immediately checkpoint.
4. Poll in short intervals.
5. On return, checkpoint evidence.
6. Decide one next explicit action.
7. Keep durable docs in parity before closeout.
