# Agent Protocol Architecture

> **Layer**: forest  
> **Module**: `src/forest/agent-protocol/`  
> **Status**: Production-ready (Phase 1)

## Purpose

Agent Protocol defines the shared contract for all Sophia autonomous agents. It ensures:
- Every agent action has a defined permission scope
- Cost is tracked and bounded per agent run
- Human approval is requested when autonomy level requires it
- Rollback plans exist before execution
- Audit trails are complete

## Core Contract

```typescript
interface AgentProtocol {
  initializeContext(ctx: AgentExecutionContext): Promise<void>;
  plan(context: AgentExecutionContext): Promise<AgentDecision>;
  execute(decision: AgentDecision): Promise<AgentResult>;
  handleApproval?(request: AgentApproval): Promise<AgentDecision>;
  rollback?(runId: string, plan: RollbackPlan): Promise<void>;
}
```

## Autonomy Levels

| Level | Name | Auto-Approve Cost | Can Execute |
|---|---|---|---|
| 0 | OBSERVE_ONLY | 0 cents | No |
| 1 | SUGGEST | 0 cents | No |
| 2 | EXECUTE_SAFE | 500 cents | Yes (safe actions) |
| 3 | EXECUTE_BROAD | 2000 cents | Yes (medium cost) |
| 4 | FULL_AUTONOMY | ∞ | Yes (all, with policy) |

## Permission Model

```typescript
interface AgentPermission {
  tool: string;           // tool pattern (supports wildcards)
  scopes: string[];       // allowed scope contexts
  requiresApproval: boolean;
  maxCostCents?: number;  // per-action cost ceiling
}
```

## Agent Runner Lifecycle

```
1. Initialize Context
   ↓ Load workspace, brand, mission, memory, permissions
2. Plan
   ↓ Generate decision (tool calls, parameters, estimated cost)
3. Check Permission
   ↓ validatePermission(agent, action, autonomyLevel)
   - Tool allowed?
   - Cost within limit?
   - Autonomy level permits?
   - If fails → return failure
4. Check Approval
   ↓ requiresApproval(action, autonomyLevel)
   - If approval needed → PAUSE, emit approval request
   - Human approves → continue
   - Human rejects → ABORT
5. Execute
   ↓ Run tool with circuit breaker + cost tracking
6. Record Result
   ↓ Log outcome, cost, duration
7. Rollback if needed
   ↓ If execution failed with side effects → rollback
```

## Cost Tracking

Every agent action:
1. Estimates cost before execution (`estimatedCostCents`)
2. Records actual cost after execution (`actualCostCents`)
3. Enforces `maxCostCents` per permission + per mission budget
4. Circuit breaker on external API calls (classified by failure kind)

## Integration Points

- **Land**: Billing tracks agent costs against workspace quota
- **Tree**: Mission lifecycle enforces autonomy level per mission
- **Forest**: Inngest runs long-horizon agent loops (continuous operation at level 4)
- **Seed**: Types define the contract (`AgentDefinition`, `AgentContext`, `AgentAction`, etc.)

## Security Model

- Agents CANNOT exceed their defined permission scope
- Agents CANNOT bypass approval gates at levels 0-3
- All tool invocations are logged to provenance
- Sensitive operations (publishing, billing) always require approval regardless of level

## See Also

- `src/seed/types/creative-domain.ts` — Full agent type definitions
- `src/forest/autonomy/` — Autonomy level enforcement
- `src/forest/agent-protocol/types.ts` — AgentRunner implementation
- `CREATIVE_MEMORY.md` — Memory available to agents during planning