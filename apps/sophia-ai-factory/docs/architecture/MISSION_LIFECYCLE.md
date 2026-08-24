# Mission Lifecycle Architecture

> **Layer**: tree (transition authority) + land (delegating Server Actions)  
> **Module**: `src/tree/mission/` — `types.ts` (lifecycle rules) · `repository.ts` (guarded CRUD) · `metrics.ts` (aggregation)  
> **Database Table**: `creative_missions`  
> **Authority decision**: `docs/architecture-decisions/ADR-mission-state-machine.md` (ACCEPTED 2026-08-24)  
> **Status**: Production-ready — single enforced transition authority

## Purpose

Mission is Sophia's top-level orchestration object. A mission encapsulates a complete creative business objective: "Build a media business around sustainable living in SEA."

## Lifecycle State Machine

Nine states, defined by the canonical `CreativeMissionStatus` union in `src/seed/types/creative-domain.ts` (external spec names are aliases; the DB column is untouched):

```
DRAFT ──► PLANNED ──► APPROVAL_REQUIRED ──► RUNNING ──► REVIEW ──► COMPLETED ──► LEARNING
  ▲                                                      │                        │
  │                                                      ▼                        ▼
  └─────────────────────────────────────────────── ITERATING ◄────────────────────┘
                                                      │
                                                      └──► draft · planned · running

Branches:
- RUNNING ⇄ PAUSED      (pause / resume)
- PAUSED ──► REVIEW     (hand a paused mission to human review)
- RUNNING ──► COMPLETED (direct completion, skipping the review pass)
- REVIEW ──► ITERATING  (another iteration instead of completing)
```

**Valid transitions** (authoritative map: `NEXT_STATUS` in `src/tree/mission/types.ts`, enforced by `canTransition()`):

- DRAFT → PLANNED
- PLANNED → APPROVAL_REQUIRED
- APPROVAL_REQUIRED → RUNNING
- RUNNING → PAUSED, REVIEW, COMPLETED
- PAUSED → RUNNING, REVIEW
- REVIEW → COMPLETED, ITERATING
- COMPLETED → LEARNING
- LEARNING → ITERATING
- ITERATING → DRAFT, PLANNED, RUNNING

> `PLANNED → PAUSED` is forbidden. An earlier revision of this document showed that edge; it contradicted `NEXT_STATUS` and has been removed. `planned` may only advance to `approval_required`.

## Execution Start (Named Rule)

Starting agent execution is a named legal rule, not a bypass. Strict `canTransition('draft', 'running')` is false by design, so a dedicated rule governs entry into `running`:

```typescript
EXECUTION_START_FROM = ['draft', 'planned', 'approval_required', 'paused'];
```

- `canStartExecution(from)` — pure predicate over the allowed set (`tree/mission/types.ts`).
- `beginMissionExecution(id)` — loads the mission, rejects `NOT_FOUND` / `EXECUTION_START_INVALID`, then atomically writes `status='running', current_phase='executing'`.
- `running`, `review`, `completed`, `learning`, and `iterating` can never start execution.

## Who May Write Mission Status (Authority)

All status writes flow through `src/tree/mission/` — the single enforced authority:

| Writer | Location | Rule applied |
|---|---|---|
| `updateMissionStatus(id, status, currentPhase)` | `tree/mission/repository.ts` | `canTransition()` + optimistic concurrency guard |
| `beginMissionExecution(id)` | `tree/mission/types.ts` | `canStartExecution()` + optimistic concurrency guard |
| Land Server Actions | `land/creative-mission/actions.ts` | Auth / Zod / workspace-membership checks, then **delegate** to the tree functions above |

Land holds zero raw `UPDATE creative_missions … SET status` statements. Forest consumers (executor, lifecycle helpers) call the same tree functions.

### Optimistic concurrency

Every guarded write binds the status observed at load time:

```sql
UPDATE creative_missions SET status = ?, current_phase = ?, updated_at = ?
WHERE id = ? AND status = ?
```

If another writer changed the row in between, `meta.changes === 0` and the stale writer fails loudly with `CONCURRENT_MODIFICATION`. This mirrors the financial atomic-lock doctrine (D1 has no transactions; two concurrent transitions must not interleave).

### Error codes (tree `MissionError`, passed through by land actions unchanged)

| Code | Meaning |
|---|---|
| `NOT_FOUND` | Mission id does not exist |
| `INVALID_TRANSITION` | Edge not present in `NEXT_STATUS` |
| `EXECUTION_START_INVALID` | Current state not in `EXECUTION_START_FROM` |
| `CONCURRENT_MODIFICATION` | Stale write lost the race; retry with fresh state |

## Machine vs Human Writes

- **Run success** → the machine advances the mission to `'review'` (via `advanceMissionToReview` in `forest/inngest/functions/agent-mission-lifecycle.ts`). The machine hands artifacts to a human reviewer and never self-completes a mission. `running → review` is a legal edge.
- **Run failure** → mission status deliberately untouched. The rollback cron retries the run (max 3 attempts within a 30-minute scan window); humans intervene through existing transitions. Failure → `paused` was considered and rejected: transient failures would flap missions while retries are pending.
- An advance-to-review rejection (for example, a concurrent human edit) is logged non-fatally so the run outcome is never masked.

## Server Actions (Land Layer)

| Action | Purpose |
|---|---|
| `createMission(data)` | Create new mission (Zod validated) |
| `updateMissionStatus(data)` | Transition mission state (delegates to tree authority) |
| `startMissionExecution(data)` | Atomically flip to `running` via `beginMissionExecution`, then emit `agent.mission.started` — invalid start states reject before any event is emitted |
| `listMissions(data)` | List workspace missions |
| `getMission(data)` | Fetch single mission with goals |

All actions:
- Use `getCurrentUser()` for auth
- Verify workspace membership (IDOR prevention)
- Return `Result<T, E>` (no throws across action boundaries); tree `MissionError` codes pass through unchanged
- Log structured audit events

## Mission Structure

```typescript
interface Mission {
  id: string;
  workspaceId: string;
  creatorId: string;
  brandId?: string;
  title: string;
  objective: string;
  audience: string;
  geography: string;
  timeframeStart: number;
  timeframeEnd: number;
  budgetCents: number;
  spentCents: number;
  autonomyLevel: 0-4;
  channels: string[];
  monetizationGoals: string[];
  constraints: Record<string, unknown>;
  successMetrics: Record<string, number>;
  status: CreativeMissionStatus;
  currentPhase: string;
  createdAt: number;
  updatedAt: number;
}
```

## Integration

- **Tree → Content Graph**: Missions spawn ContentProjects
- **Tree → Creative Memory**: Mission learnings stored as memory
- **Forest → Agent Protocol**: Agents execute missions at assigned autonomy level (event contract: `AGENT_PROTOCOL.md`)
- **Land → Billing**: Mission budget tracked against workspace quota

## Why Renamed from `missions` → `creative_missions`

Mekong already uses a `missions` table for command execution (different semantic). Renamed to avoid collision while keeping both concepts.

## See Also

- `../architecture-decisions/ADR-mission-state-machine.md` — authority decision record
- `../../src/tree/mission/types.ts` — `NEXT_STATUS`, `canTransition`, `EXECUTION_START_FROM`, `beginMissionExecution`
- `../../src/tree/mission/repository.ts` — optimistic-guarded CRUD writes
- `../../src/seed/types/creative-domain.ts` — canonical `CreativeMissionStatus` union
- `../../src/land/creative-mission/actions.ts` — delegating Server Actions
- `AGENT_PROTOCOL.md` — mission event loop and agent execution contract
- `CREATIVE_MEMORY.md` — Where mission learnings go
