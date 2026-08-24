# ADR: Mission State-Machine Authority

**Status:** ACCEPTED
**Date:** 2026-08-24
**Scope:** `creative_missions.status` — who may write it, under which rules

## Context

Mission status is the coordination spine of the Creative Economy OS
(mission → content → distribution → measure → learn). Before this decision,
four writers existed with three different rulebooks and one bypass:

| # | Writer | Location | Rule applied |
|---|---|---|---|
| W1 | `updateMissionStatus()` | `src/tree/mission/types.ts:216` | `canTransition()` against the `NEXT_STATUS` map (`types.ts:115–125`); throws `MissionError` |
| W2 | `updateMissionStatus()` Server Action | `src/land/creative-mission/actions.ts:172–258` | Re-implements the `canTransition()` check inline, then its own raw `UPDATE … SET status` (actions.ts:241) — duplicate of W1's logic, divergent shape (no `current_phase` write) |
| W3 | `startMissionExecution()` Server Action | `src/land/creative-mission/actions.ts:423–427` | **None** — raw `UPDATE … SET status='running'` with zero transition validation |
| W4 | `agent-mission-executor` (Inngest) | `src/forest/inngest/functions/agent-mission-executor.ts` | Updates only `agent_runs`; never touches `creative_missions.status` — despite the land action's docstring claiming it does (actions.ts:377–379) |

Verified structural facts:

- The 9-state union (`src/seed/types/creative-domain.ts:464–473`), its Zod
  mirror (`src/seed/types/creative-economy/entities-schema.ts:53–63`), and the
  DB column (`migrations/0233_missions.sql:24`, plain `TEXT DEFAULT 'draft'`,
  no CHECK constraint) all agree.
- The only doc divergence was `docs/architecture/MISSION_LIFECYCLE.md:52`
  claiming `PLANNED → PAUSED`, which the `NEXT_STATUS` map forbids.
- An external 8-state spec exists outside this repo; its names differ
  cosmetically from the union above.

## Decisions

### D1 — Transition authority lives exclusively in `tree/mission`

`NEXT_STATUS` / `canTransition()` stay in `src/tree/mission/types.ts`. The
land layer stops re-implementing transition logic and delegates to tree
functions (keeping its auth/permission checks). The forest layer consumes the
same tree functions. Rationale: layer architecture — tree is the
domain-reusable layer; seed holds stateless primitives, and a stateful
repository does not belong there. `tree/mission` was already the de-facto
canonical home.

### D2 — The 9-state union is canonical; spec names are aliases

The union in `creative-domain.ts` is the single source of truth. The external
spec's 8 state names are treated as aliases mapping onto this union. The DB
column is untouched: no migration, no CHECK constraint, no renames. This is
reversible and carries zero migration risk for zero functional loss.

### D3 — Execution start is a named legal rule, not a bypass

The W3 bypass is legalized explicitly rather than deleted:

```ts
EXECUTION_START_FROM: readonly CreativeMissionStatus[] =
  ['draft', 'planned', 'approval_required', 'paused']
```

with `canStartExecution(from)` and an atomic `beginMissionExecution(id)` in
`tree/mission`. Rationale: strict `canTransition('draft', 'running')` is
false and would brick the only working entry point into execution. An
explicit named rule beats a silent raw UPDATE — same practical behavior for
every state reachable today, but auditable, greppable
(`EXECUTION_START_INVALID`), and tested. States `review`, `completed`,
`learning`, `iterating`, and `running` itself cannot start execution.

### D4 — Optimistic concurrency guard on all status writes

Every status write uses a conditional update:
`UPDATE … WHERE id = ? AND status = ?` binding the status observed at load
time; `meta.changes === 0` rejects with `CONCURRENT_MODIFICATION`. Rationale:
D1 has no transactions; two concurrent transitions must not interleave. The
prior read-validate-write shape in W1/W2 was a race. This mirrors the
financial atomic-lock doctrine (`INSERT … ON CONFLICT DO NOTHING` +
changes-count ownership check).

### D5 — The machine never auto-completes a mission

On agent-run success the mission advances to `'review'` — a human reviews the
artifacts. On failure the mission status is untouched (the rollback cron
retries; humans intervene via existing transitions). Rationale: human
creative ownership is first-class; the machine hands work to review, never
self-completes. `running → review` is already legal in `NEXT_STATUS`.
Failure-to-paused was considered and rejected: transient failures would flap
the mission while retries are pending.

### D6 — `PLANNED → PAUSED` remains forbidden

The lifecycle documentation's `PLANNED → PAUSED` edge is wrong and is
corrected in the docs. The `NEXT_STATUS` map is authoritative: `planned` may
only advance to `approval_required`.

## Invariants (enforced in code)

1. The 9-state union is canonical; spec 8-state names are aliases; the DB
   status column is untouched.
2. `tree/mission` is the single enforced authority for status transitions;
   land and forest delegate to it.
3. Execution start is governed by the named rule `EXECUTION_START_FROM`
   (`draft`, `planned`, `approval_required`, `paused` → `running`).
4. All status writes are optimistic-guarded; a stale write fails loudly with
   `CONCURRENT_MODIFICATION`.
5. `PLANNED → PAUSED` is forbidden.
6. The machine never auto-completes a mission: run success → `review`;
   run failure → mission untouched.

## Consequences

- Land actions map tree `MissionError` codes (`NOT_FOUND`,
  `INVALID_TRANSITION`, `CONCURRENT_MODIFICATION`, `EXECUTION_START_INVALID`)
  into their Result shapes; error codes pass through unchanged.
- Raw `UPDATE creative_missions SET status` statements outside `tree/mission`
  are a violation of this ADR.
- Reversing D2 would require a migration; reversing D3/D4 is a code-only
  change confined to `tree/mission`.
