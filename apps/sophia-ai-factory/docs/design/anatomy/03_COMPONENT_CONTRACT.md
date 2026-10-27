# 03_COMPONENT_CONTRACT.md — Sophia Creative Assembly Line Component & View-Model Contract

**Document Code:** `docs/design/anatomy/03_COMPONENT_CONTRACT.md`  
**Layer Placement:**  
- View-Model & Pure Mapper: `src/tree/mission/workflow-view-model.ts` (`tree` layer — imports `seed` only)  
- Interactive Isometric UI: `src/components/workflow-anatomy/creative-assembly-line.tsx` (`components` presentation layer)  

---

## 1. Canonical TypeScript Interfaces

```typescript
export type WorkflowMode = 'illustration' | 'verified-job';

export type WorkflowStationId =
  | 'intake_brief'
  | 'script_planning'
  | 'ceo_approval_gate'
  | 'media_render'
  | 'publish_ledger';

export type WorkflowStationState =
  | 'not_started'
  | 'queued'
  | 'running'
  | 'needs_approval'
  | 'succeeded'
  | 'failed'
  | 'unknown';

export interface WorkflowStationItem {
  id: WorkflowStationId;
  order: 1 | 2 | 3 | 4 | 5;
  state: WorkflowStationState;
  mechanismTag: string;
  costCents?: number;
  tokensUsed?: number;
  errorMessage?: string;
}

export interface WorkflowView {
  mode: WorkflowMode;
  missionId?: string;
  missionStatus?: string;
  overallState: WorkflowStationState;
  activeStationId: WorkflowStationId;
  stations: readonly [
    WorkflowStationItem,
    WorkflowStationItem,
    WorkflowStationItem,
    WorkflowStationItem,
    WorkflowStationItem,
  ];
  totalCostCents: number;
  totalTokens: number;
}
```

---

## 2. Deterministic State Mapping Rules (`buildVerifiedMissionWorkflowView`)

The mapper function `buildVerifiedMissionWorkflowView(input)` accepts a verified `Mission` status (`CreativeMissionStatus`) and its associated `AgentRunRecord[]` list, returning a deterministic `WorkflowView` with `mode: 'verified-job'`:

| Mission Status (`mission.status`) | Station 1 (`intake_brief`) | Station 2 (`script_planning`) | Station 3 (`ceo_approval_gate`) | Station 4 (`media_render`) | Station 5 (`publish_ledger`) | Active Focus Station |
|---|---|---|---|---|---|---|
| `draft` | `running` | `not_started` | `not_started` | `not_started` | `not_started` | `intake_brief` |
| `planned` | `succeeded` | `succeeded` | `queued` | `not_started` | `not_started` | `script_planning` |
| `approval_required` | `succeeded` | `succeeded` | `needs_approval` | `not_started` | `not_started` | `ceo_approval_gate` |
| `running` | `succeeded` | `succeeded` | `succeeded` | `running` | `queued` | `media_render` |
| `paused` | `succeeded` | `succeeded` | `succeeded` | `queued` | `not_started` | `media_render` |
| `review` | `succeeded` | `succeeded` | `needs_approval` | `succeeded` | `queued` | `ceo_approval_gate` |
| `completed` | `succeeded` | `succeeded` | `succeeded` | `succeeded` | `succeeded` | `publish_ledger` |
| `learning` / `iterating` | `succeeded` | `running` | `queued` | `not_started` | `not_started` | `script_planning` |
| Latest run `status === 'failed'` | `succeeded` | `succeeded` | `succeeded` | `failed` (or failing phase) | `not_started` | Failing station |

**Strict Anti-Deception Invariant**:
- If a mission is in `draft`, `approval_required`, `paused`, or has a `failed` agent run, `publish_ledger` is **NEVER** marked `succeeded`.
- `buildIllustrativeWorkflowView()` returns a fixed, deterministic `mode: 'illustration'` view explicitly badged as an architectural demonstration. It uses zero `Math.random()` calls and zero fake timers.

---

## 3. Multi-Tenant & Security Boundaries

1. **Zero Direct DB Queries in Client Components**: `CreativeAssemblyLine` receives only the serialized `WorkflowView` prop.
2. **Server-Side Ownership Check**: In `src/app/[locale]/dashboard/missions/[id]/page.tsx`, `getMission({ missionId })` enforces workspace membership and creator/admin access before `listAgentRunsForMission(missionId, mission.workspaceId, 10)` is called. Unauthorized access triggers `notFound()` before `buildVerifiedMissionWorkflowView` is ever invoked.
3. **Zero Secret Leakage**: `WorkflowStationItem` strips raw `inputJson`/`outputJson` payloads and exposes only sanitized aggregate telemetry (`costCents`, `tokensUsed`, and sanitized `errorMessage`).
