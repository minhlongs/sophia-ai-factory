# Autonomy Architecture

> **Layer**: tree
> **Module**: `src/tree/autonomy/`
> **Status**: Production-ready (Phase 1)

## Purpose

The Autonomy system enforces graduated agent permissions — controlling what actions
an agent can take without human approval based on a configurable autonomy level.
This ensures that agents operate within safe bounds while allowing progressive
autonomy as trust increases.

## Autonomy Levels

| Level | Name | Auto-Approve Cost | Can Execute | Description |
|-------|------|-------------------|-------------|-------------|
| 0 | OBSERVE_ONLY | 0 cents | No | Agent observes only — no proposals, no actions |
| 1 | SUGGEST | 0 cents | No | Agent proposes actions, human approves all |
| 2 | EXECUTE_SAFE | 500 cents | Yes (safe) | Read-only / informational actions auto-approved |
| 3 | EXECUTE_BROAD | 2000 cents | Yes (medium) | Routine actions auto-approved; high-risk blocked |
| 4 | FULL_AUTONOMY | ∞ | Yes (all) | All actions allowed per policy |

## Module Structure

```
src/tree/autonomy/
├── index.ts                    # Re-exports public API
├── autonomy-repo.ts            # D1 persistence + pure gate logic
├── autonomy-repo.test.ts       # Unit tests
└── __tests__/
    └── check-action-allowed.test.ts  # Pure gate tests
```

## Public API

### `getAutonomyConfig(workspaceId, agentType?)`

Fetch autonomy config for a workspace + optional agent type. Falls back to global
config when agent-specific config does not exist. Returns built-in default
(level 1) when nothing is stored.

### `setAutonomyLevel(workspaceId, level, agentType?)`

Set autonomy level for a workspace + optional agent type. Upserts via
INSERT OR REPLACE.

### `checkActionAllowed(level, actionType)`

**Pure function** — maps an autonomy level to whether an action is permitted,
without touching the database.

Rules:
- **Level 0**: always false
- **Level 1**: always false (agent only proposes)
- **Level 2**: allow low-risk read-only actions (`read_mission`, `list_approvals`,
  `get_status`, `fetch_metrics`, `read_logs`)
- **Level 3**: allow all routine actions; block high-risk (`spend_credits`,
  `delete_mission`, `update_billing`, `revoke_credentials`, `webhook_deregister`)
- **Level 4**: always true

### `isActionAllowed(workspaceId, actionType, agentType?)`

Async wrapper — loads config from D1, then delegates to the pure gate logic.

## Integration Points

- **Agent Executor** (`tree/agent-protocol/agent-executor.ts`): Before executing
  an action, the executor calls `isActionAllowed()` to check if the workspace's
  autonomy level permits it.
- **Mission Lifecycle** (`tree/mission/`): Uses autonomy levels to determine
  whether missions can advance without approval gates.
- **Provenance** (`seed/types/creative-domain.ts`): Every autonomy-gated decision
  is logged in `ProvenanceRecord` for audit.

## Schema (D1)

```sql
CREATE TABLE IF NOT EXISTS autonomy_configs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  agent_type TEXT NOT NULL DEFAULT 'global',
  level INTEGER NOT NULL DEFAULT 1,
  overrides_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(workspace_id, agent_type)
);
```

## Configuration

Default autonomy level is 1 (SUGGEST) — agents propose, humans approve.
Operators can raise levels per workspace or per agent type via the settings
dashboard or direct D1 update.

## Testing

- Unit tests: `src/tree/autonomy/autonomy-repo.test.ts`
- Pure gate tests: `src/tree/autonomy/__tests__/check-action-allowed.test.ts`
- E2E integration: `src/__tests__/integration/creative-mission-e2e.test.ts`
  (verifies autonomy checks during full flywheel test)
