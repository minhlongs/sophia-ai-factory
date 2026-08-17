# Buzz Boundary — Sophia ↔ Buzz Interface

> **Status**: Design guideline (Buzz not yet integrated)  
> **Goal**: Buzz remains autonomy/execution layer, not another application-specific framework

## Why This Boundary Exists

Buzz provides the autonomy runtime for agent execution. If Buzz becomes Sophia-specific (e.g., "Buzz Creative Agent"), then:
- Sophia's agent logic is locked to Buzz's execution model
- Other applications can't reuse Buzz
- Sophia inherits Buzz's architectural debt

## Allowed Interactions

### Sophia → Buzz

Sophia MAY use Buzz for:
- Agent execution (long-running creative tasks)
- Autonomy level enforcement
- Tool invocation with circuit breaker
- Cost tracking and quota enforcement

**Example (allowed):**
```typescript
// Sophia delegates execution to Buzz autonomy layer
const result = await buzz.execute({
  agentId: 'content_creator',
  missionId: mission.id,
  autonomyLevel: mission.autonomyLevel,
  actions: plannedActions,
});
```

### Buzz → Sophia

Buzz MAY read from Sophia:
- Agent definitions (what tools/actions are available)
- Permission policies (what autonomy level allows)
- Domain types (for typed tool parameters)

Buzz MUST NOT:
- Modify Sophia's business logic
- Directly write to Sophia's tables (use Sophia's APIs)
- Embed Sophia-specific workflows

## Buzz Responsibilities

| Concern | Owner |
|---|---|
| Agent lifecycle (initialize → plan → execute → rollback) | Buzz |
| Tool invocation + circuit breaker | Buzz |
| Cost tracking per agent run | Buzz |
| Autonomy level enforcement | Buzz |
| Approval request/response flow | Buzz |
| **Creative domain logic** | **Sophia** |
| **Business workflows (billing, payouts)** | **Sophia** |
| **Content graph CRUD** | **Sophia** |

## Separation Example

```
BUZZ (generic autonomy runtime):
  - runsAgent()
  - checksPermission()
  - invokesTool()
  - tracksCost()

SOPHIA (creative domain):
  - defines creative tools (content.create, video.upload)
  - implements content graph CRUD
  - handles billing for agent costs
  - stores creative memory
```

## Integration Point

Buzz interacts with Sophia through the **Agent Protocol** interface:

```typescript
// Sophia defines the protocol (in forest/agent-protocol)
interface AgentProtocol {
  initializeContext(ctx: AgentExecutionContext): Promise<void>;
  plan(context: AgentExecutionContext): Promise<AgentDecision>;
  execute(decision: AgentDecision): Promise<AgentResult>;
}

// Buzz implements the runner (in buzz autonomy layer)
class BuzzAgentRunner implements AgentProtocol {
  // Buzz's execution logic
}
```

Sophia provides the domain-specific implementations; Buzz provides the runtime.

## What Buzz Must NOT Become

- ❌ A "Creative Agent" with hardcoded video generation logic
- ❌ A workflow engine with Sophia-specific steps
- ❌ A content scheduler tied to YouTube/Telegram APIs
- ❌ A billing system for agent costs

## See Also

- `AGENT_PROTOCOL.md` — The interface contract
- `MEKONG_BOUNDARY.md` — Mekong boundary (same principles apply)
- `src/forest/agent-protocol/types.ts` — Protocol implementation