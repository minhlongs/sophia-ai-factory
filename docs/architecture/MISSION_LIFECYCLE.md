# Mission Lifecycle Architecture

> **Layer**: tree + land  
> **Module**: `src/tree/mission/` (CRUD) + `src/land/creative-mission/` (Server Actions)  
> **Database Table**: `creative_missions`  
> **Status**: Production-ready (Phase 1)

## Purpose

Mission is Sophia's top-level orchestration object. A mission encapsulates a complete creative business objective: "Build a media business around sustainable living in SEA."

## Lifecycle State Machine

```
                    ┌──────────────────┐
                    │      DRAFT        │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │     PLANNED       │◄─────────────────┐
                    └────────┬─────────┘                  │
                             │                            │
              ┌──────────────┼──────────────┐             │
              │              │              │             │
              ▼              ▼              ▼             │
       ┌─────────────┐ ┌──────────┐ ┌─────────────┐      │
       │ APPROVAL_   │ │  PAUSED  │ │   REVIEW    │      │
       │ REQUIRED    │ └────┬─────┘ └──────┬──────┘      │
       └──────┬──────┘      │              │              │
              │             │              │              │
              ▼             ▼              ▼              │
       ┌─────────────┐ ┌──────────┐ ┌─────────────┐      │
       │   RUNNING    │ │ RUNNING  │ │  COMPLETED  │      │
       └──────┬──────┘ └──────────┘ └──────┬──────┘      │
              │                              │              │
              │                              ▼              │
              │                    ┌──────────────────┐    │
              │                    │    LEARNING      │    │
              │                    └────────┬─────────┘    │
              │                             │              │
              │                             ▼              │
              │                    ┌──────────────────┐    │
              │                    │   ITERATING      │────┘
              │                    └──────────────────┘
              │
       (mission ends / archived)
```

**Valid transitions:**
- DRAFT → PLANNED
- PLANNED → APPROVAL_REQUIRED, PAUSED
- APPROVAL_REQUIRED → RUNNING
- RUNNING ↔ PAUSED
- RUNNING → REVIEW, COMPLETED
- REVIEW → COMPLETED, ITERATING
- COMPLETED → LEARNING
- LEARNING → ITERATING
- ITERATING → DRAFT, PLANNED, RUNNING

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
  timeframeStart: number;  // unix timestamp
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

## Server Actions (Land Layer)

| Action | Purpose |
|---|---|
| `createMission(data)` | Create new mission (Zod validated) |
| `updateMissionStatus(id, status)` | Transition mission state |
| `listMissions(workspaceId)` | List workspace missions |
| `getMission(id)` | Fetch single mission with goals |

All actions:
- Use `getCurrentUser()` for auth
- Validate via `canTransition()` before state change
- Return `Result<T, E>` (no throws)
- Log structured audit events

## Integration

- **Tree → Content Graph**: Missions spawn ContentProjects
- **Tree → Creative Memory**: Mission learnings stored as memory
- **Forest → Agent Protocol**: Agents execute missions at assigned autonomy level
- **Land → Billing**: Mission budget tracked against workspace quota

## Why Renamed from `missions` → `creative_missions`

Mekong already uses a `missions` table for command execution (different semantic). Renamed to avoid collision while keeping both concepts.

## See Also

- `src/seed/types/creative-domain.ts` — Mission interface
- `src/tree/mission/types.ts` — CRUD operations
- `src/land/creative-mission/actions.ts` — Server Actions
- `CREATIVE_MEMORY.md` — Where mission learnings go