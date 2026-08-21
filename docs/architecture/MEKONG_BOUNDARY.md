# Mekong Boundary — Sophia ↔ Mekong Interface

> **Status**: Enforced by ESLint + CI guard  
> **Rule file**: `.claude/rules/cross-layer-orchestration.md`

## Why This Boundary Exists

Mekong is the horizontal agent/control-plane layer. Sophia is the vertical Creative Economy application. If Sophia imports Mekong internals, it becomes coupled to Mekong's implementation — making it impossible to:
- Upgrade Mekong independently
- Replace Mekong with a different agent framework
- Understand Sophia's domain logic without reading Mekong

## Allowed Interactions

### Sophia → Mekong (one-way only)

Sophia MAY call Mekong through **documented public interfaces**:

| Interface | Use | Location |
|---|---|---|
| Agent spawning | Sophia delegates to Mekong CLI | `mekong-cli` agent |
| Cross-repo symlinks | Shared development setup | `.mekong/` directory |
| Agent instructions | Mekong reads Sophia's agent defs | `.claude/agents/` |

**Example (allowed):**
```typescript
// Sophia forest layer orchestrates via Mekong CLI
import { spawnAgent } from '@/mekong/bridge';  // public interface
await spawnAgent('code-reviewer', { prompt: 'Review this PR' });
```

### Mekong → Sophia (read-only)

Mekong MAY read Sophia's:
- Agent instruction files (`.claude/agents/*.md`)
- Domain type definitions (for agent contracts)
- Public API surface (API routes, Server Actions)

Mekong MUST NOT:
- Import Sophia's internal modules (`src/land/`, `src/forest/`)
- Modify Sophia's database directly
- Call Sophia's private functions

## Forbidden Patterns

```typescript
// ❌ FORBIDDEN: Sophia importing Mekong internals
import { MissionEngine } from '@mekong/core/missions';  // Mekong internal

// ✅ ALLOWED: Sophia using Mekong public interface
import { spawnAgent } from '@/mekong/bridge';  // Sophia's own bridge

// ❌ FORBIDDEN: Land layer calling forest for orchestration (circular)
import { runAgent } from '@/forest/agent-protocol';  // land→forest

// ✅ ALLOWED: Forest calling land for business workflow (documented exception)
import { activateSubscription } from '@/land/billing/actions';  // forest→land
```

## Enforcement

```bash
# CI guard: land must not import forest
grep -rn "from ['\"]@/forest" src/land/  # must return 0 results

# CI guard: tree must not import land/forest
grep -rn "from ['\"]@/land\|from ['\"]@/forest" src/tree/  # must return 0 results
```

## Table Name Collisions

**Resolved 2026-08-16**: Mekong uses `missions` table (command execution). Sophia renamed to `creative_missions`.

**Rule**: If Mekong adds a table that collides with Sophia domain concepts, Sophia prefixes with `creative_` or `sophia_`.

## See Also

- `.claude/rules/sophia-layer-architecture.md` — 4-layer import rules
- `.claude/rules/cross-layer-orchestration.md` — Forest→Land exception
- `BUZZ_BOUNDARY.md` — Buzz autonomy layer boundary