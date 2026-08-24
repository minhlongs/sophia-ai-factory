# Agent Protocol Architecture

> **Layer**: tree (canonical executor + registry) + forest (Inngest functions)  
> **Module**: `src/tree/agent-protocol/` (`agent-executor.ts`, `agent-registry.ts`) · Inngest functions in `src/forest/inngest/functions/`  
> **Event contracts**: `src/seed/inngest/agent-event-types.ts`  
> **Status**: Registered and live — deliberately inert on execution until provider wiring ships (see [Deliberate Inertness](#deliberate-inertness-until-provider-wiring))

## Purpose

Agent Protocol defines the shared contract for all Sophia autonomous agents. It ensures:
- Every agent action passes the workspace autonomy gate (fail-closed)
- Cost is tracked and bounded per agent run
- Human approval is enforced per permission (`requiresApproval`)
- Audit trails are complete (provenance records per artifact)

## Core Executor Contract

The canonical executor lives in `src/tree/agent-protocol/agent-executor.ts`:

```typescript
executeAgent(
  definition: AgentDefinition,
  context: AgentContext,
  registry: ProviderRegistry,
): Promise<Result<AgentExecutionResult, ExecutorError>>
```

Executor failure codes (`ExecutorErrorCode`): `NO_PROVIDER`, `NO_PROVIDER_HEALTHY`, `AUTONOMY_DENIED`, `PROVIDER_ERROR`, `BUDGET_EXCEEDED`, `EXECUTION_FAILED`.

Agent definitions are resolved from `agentDefinitionRegistry` (`src/tree/agent-protocol/agent-registry.ts`). Types come from `src/seed/types/creative-domain.ts` (`AgentDefinition`, `AgentContext`, `AgentPermission`).

## Autonomy Levels

Five levels (`AutonomyLevel = 0 | 1 | 2 | 3 | 4`), enforced by the pure gate `checkActionAllowed()` in `src/tree/autonomy/autonomy-repo.ts`. Config errors fall back to level 0 (deny) — the gate fails closed.

| Level | Behavior |
|---|---|
| 0 | Deny everything |
| 1 | Deny everything (agent only proposes) |
| 2 | Read-only actions only: `read_mission`, `list_approvals`, `get_status`, `fetch_metrics`, `read_logs` |
| 3 | All routine actions; blocked: `spend_credits`, `delete_mission`, `update_billing`, `revoke_credentials`, `webhook_deregister` |
| 4 | Allow all |

## Permission Model

```typescript
interface AgentPermission {
  tool: string;
  scopes: string[];
  requiresApproval: boolean;
  maxCostCents?: number;
}
```

Every declared permission independently passes the autonomy gate, and any permission with `requiresApproval` must be backed by an approved action id in the context — otherwise the run fails with `AUTONOMY_DENIED` before any provider call.

## Mission Event Loop

All five payloads are typed in `src/seed/inngest/agent-event-types.ts`; senders construct payloads against these contracts so keys cannot drift.

```
startMissionExecution (land Server Action)
  │  beginMissionExecution() — atomic 'running' flip via tree authority
  ▼
agent.mission.started ──────────► agent-mission-executor (Inngest)
  { runId, agentId, missionId,      │ creates agent_runs row, runs executeAgent()
    workspaceId,                    ├─ success ─► agent.mission.completed
    autonomyLevel?, inputJson? }    │            + mission advanced to 'review'
                                    └─ failure ─► agent.mission.failed
                                                   (mission status untouched)

agent.mission.completed ────────► provenance-bridge (Inngest)
  { runId, agentId, missionId,      │ records provenance per artifact
    totalCostCents, totalTokens }   │ (run-level record when no artifacts exist)
                                    └─ records creative-memory learning entry

agent.mission.failed ───────────► (audit trail event; no consumer yet.
  { runId, agentId, missionId,       recovery is pull-based: rollback cron)
    errorCode, errorMessage }

agent.approval.resolved ────────► agent-approval-handler (Inngest)
  { approvalId, runId,              no production sender yet — handler dormant
    status, reviewerId, comment? }

agent-rollback-cron (every 5 min): scans failed agent_runs within the last
30 minutes, retry_count < 3 → re-dispatches agent.mission.started (LIMIT 50).
```

### Emission helpers

`src/forest/inngest/functions/agent-mission-lifecycle.ts` owns emission and the review handoff:

- `emitMissionCompleted(client, payload)` / `emitMissionFailed(client, payload)` — payload types imported from the seed contracts (no inline literals).
- `advanceMissionToReview(missionId)` — wraps tree `updateMissionStatus(id, 'review', 'review')`. Machine hands artifacts to human review and never self-completes a mission. A rejected transition (e.g. concurrent human edit) is logged non-fatally; the run outcome is not masked.

On failure the mission status is deliberately untouched — the rollback cron retries, humans intervene through existing transitions (see `MISSION_LIFECYCLE.md`).

## Registration

All four agent functions are registered in `serve()` at `src/app/api/inngest/route.ts`: `agentMissionExecutor`, `agentApprovalHandler`, `agentRollbackCron`, `provenanceBridge`. A route-registration test asserts every import appears in the served array.

## Deliberate Inertness (until provider wiring ships)

Registration is live, but real AI execution is intentionally dormant:

- `getSharedRegistry()` (`forest/ai/provider-factory.ts`) returns an **empty** provider registry until a provider-wiring cycle resolves workspace BYOK keys into it.
- An empty registry makes `executeAgent` fail fast with `NO_PROVIDER`.
- The autonomy gate adds a second deterministic fail-fast layer (`isActionAllowed` falls back to deny on config error).
- Failed runs are marked `failed` in `agent_runs` and retried at most 3 times by the rollback cron — a loud, bounded failure replacing the previous silent event drop.

This is honest-by-design: faking provider resolution would violate the no-mocks rule. The dormant handlers (`agentApprovalHandler` has no sender; `provenanceBridge` fires only after a successful run) stay inert until their product cycles ship.

## Security Model

- Agents CANNOT exceed their defined permission scope
- Agents CANNOT bypass approval gates — missing approval evidence fails the run closed
- All tool invocations are recorded to provenance
- Sensitive operations (spend, delete, billing, credentials) are blocked below level 4

## See Also

- `../architecture-decisions/ADR-mission-state-machine.md` — who may write mission status
- `MISSION_LIFECYCLE.md` — transition map, execution-start rule, machine-vs-human writes
- `../../src/tree/agent-protocol/agent-executor.ts` — canonical executor
- `../../src/seed/inngest/agent-event-types.ts` — five payload contracts
- `../../src/forest/inngest/functions/agent-mission-lifecycle.ts` — emission + review handoff
- `PROVENANCE.md` — provenance record model
- `CREATIVE_MEMORY.md` — memory available to agents during planning
