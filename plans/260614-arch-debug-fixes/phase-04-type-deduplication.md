# Phase 04: Deduplicate Multi-Agent Types

**Priority:** P2 (Buffer)  
**Status:** Not Started  
**Estimated Duration:** 2 hours

---

## Context Links

- **Deep Research:** Buffer item — "Multi-agent SOP types duplicated"
- **Files:** `src/seed/db/types.ts`, `src/forest/agents/types.ts`, `src/tree/agents/types.ts`
- **Related:** `src/forest/sop/executor/agents-yaml-parser.ts`

---

## Overview

There is type duplication across layers for agent-related types:
- `seed/db/types.ts` — DB row types (snake_case, D1 interfaces)
- `forest/agents/types.ts` — Domain interfaces (camelCase, client-facing)
- `tree/agents/types.ts` — May duplicate or re-export

Also inconsistency: `AgentDbRow.role` only allows `'CEO' | 'Developer'` but domain `AgentRole` includes `'QA' | 'Ops' | 'Marketing'`.

---

## Requirements

### Functional
1. Identify duplicate type definitions
2. Consolidate using re-exports where appropriate
3. Fix `AgentDbRow.role` to match domain `AgentRole` OR document why limited
4. Ensure `agents-yaml-parser.ts` uses canonical types

### Non-Functional
1. No breaking changes to existing queries (D1 bindings)
2. Preserve type safety — avoid `any`
3. Keep DB row types separate from domain interfaces (different naming conventions)
4. Barrel exports where helpful

---

## Implementation Steps

### Step 1: Compare type files

Read:
- `src/forest/agents/types.ts`
- `src/tree/agents/types.ts`
- `src/seed/db/types.ts`

Check:
- Does `tree/agents/types.ts` re-export from `forest/`? If yes, good.
- Does `seed/db/types.ts` define `AgentDbRow.role` as `'CEO' | 'Developer'` only?
- Are there duplicate interfaces (e.g., `Agent`, `AgentTeam` defined in multiple places)?

### Step 2: Fix tree re-export (if needed)

If `src/tree/agents/types.ts` contains duplicates, replace with:
```typescript
export * from '@/forest/agents/types';
// Plus DB-specific types from seed if needed
export * from '@/seed/db/types';
```

### Step 3: Align AgentDbRow.role with AgentRole

**Check DB schema first:** Look at `migrations/0016-agent-factory.sql` (or similar):
```sql
CREATE TABLE agents (
  role TEXT CHECK (role IN ('CEO', 'Developer'))  -- or no constraint?
);
```

If CHECK constraint exists:
- Need migration to add `'QA'`, `'Ops'`, `'Marketing'`
- **Risk:** Existing rows with old roles still valid
- **Migration approach:**
  ```sql
  ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_role_check;
  ALTER TABLE agents ADD CONSTRAINT agents_role_check CHECK (role IN ('CEO','Developer','QA','Ops','Marketing'));
  ```

If no constraint (free text):
- Just update TypeScript type to match domain:
  ```typescript
  export type AgentRole = 'CEO' | 'Developer' | 'QA' | 'Ops' | 'Marketing';
  export interface AgentDbRow {
    role: AgentRole;
    // ...
  }
  ```

### Step 4: Consolidate duplication

Choose canonical sources:
- **Domain interfaces:** `forest/agents/types.ts` (Agent, AgentTeam, AgentTask, AgentLog)
- **DB row types:** `seed/db/types.ts` (AgentRow, AgentTeamRow, etc.)

Ensure `forest/agents/repository.ts` (or similar) correctly maps Row → Interface.

If `tree/agents/` has duplicate definitions, replace with re-exports.

### Step 5: Update agents-yaml-parser

Check `src/forest/sop/executor/agents-yaml-parser.ts`:
- Ensure it imports types from `@/forest/agents/types` (canonical)
- No inline type definitions that duplicate

### Step 6: Run typecheck and tests

```bash
npm run ci:typecheck
npm test -- src/forest/agents/__tests__/ src/tree/agents/__tests__/
```

---

## Related Code Files

- `src/forest/agents/types.ts`
- `src/tree/agents/types.ts`
- `src/seed/db/types.ts`
- `migrations/0016-agent-factory.sql` (or agent-related migrations)
- `src/forest/sop/executor/agents-yaml-parser.ts`
- `src/forest/agents/repository.ts` (if exists)

---

## Success Criteria

- No duplicate type definitions across layers
- `AgentDbRow.role` matches domain `AgentRole` (all 5 roles) OR documented limitation with migration plan
- `tree/agents/types.ts` re-exports from `forest/` and `seed/`
- Typecheck passes for these files
- No runtime regressions

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| DB migration needed for role enum | Medium | High | Create separate migration; don't block this phase on DB change |
| Circular dependencies after re-export | Low | Medium | Keep DB types in seed, domain types in forest; tree only re-exports |
| Existing code expects limited roles | Medium | Medium | Search for role-switch statements; ensure new roles handled gracefully (default case) |

---

## Security Considerations

- **Type safety:** Proper role enum prevents invalid assignments
- **Authorization:** Role checks in permissions system must account for all roles

---

**END OF PHASE 04**
