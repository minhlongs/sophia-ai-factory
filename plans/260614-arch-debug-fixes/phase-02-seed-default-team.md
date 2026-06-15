# Phase 02: Seed Default Team (QA/Ops/Marketing)

**Priority:** P1 (Buffer)  
**Status:** Not Started  
**Estimated Duration:** 2 hours

---

## Context Links

- **Deep Research Report:** Buffer item — "Default team incomplete — only seeds CEO + Developer"
- **File:** `src/forest/agents/seed-default-team.ts` (or `src/tree/agents/seed-default-team.ts`)
- **Related:** `src/seed/auth/openclaw-token.ts` (org creation), `src/app/actions/auth.ts` (web signup)

---

## Overview

The default team seeding currently only creates CEO and Developer agents. Need to add QA, Ops, and Marketing roles so that agent teams are fully populated out-of-the-box.

**Current state:**
- `seedDefaultTeam(orgId)` likely creates 2 agents with roles `'CEO' | 'Developer'`
- AgentRole enum in `forest/agents/types.ts` may already include `'QA' | 'Ops' | 'Marketing'` but DB/seed doesn't create them
- OpenClaw token flow (API-only orgs) may bypass team seeding entirely

---

## Requirements

### Functional
1. Update `seedDefaultTeam()` to create **5 agents**:
   - CEO (existing)
   - Developer (existing)
   - QA (new)
   - Ops (new)
   - Marketing (new)
2. Ensure each agent has appropriate default prompt/system message (from `prompts.ts` or similar)
3. Verify `seedDefaultTeam()` is called in **ALL** org creation paths:
   - Web signup (`/auth/signup` or onboarding flow)
   - OpenClaw token generation (`openclaw-token.ts`)
4. Make function idempotent (already likely) — safe to call multiple times

### Non-Functional
1. No breaking changes to existing agent queries (backward compatible)
2. Default prompts should be minimal but functional (e.g., "You are the QA agent for Sophia")
3. Database: `agents` table must accept new roles — check `AgentDbRow.role` type
4. Follow existing pattern for agent creation (likely `INSERT INTO agents ...`)

---

## Architecture

**Default team pattern:**
```typescript
export async function seedDefaultTeam(orgId: string): Promise<void> {
  const db = createServerClient();
  const agents = [
    { role: 'CEO' as const, ... },
    { role: 'Developer' as const, ... },
    // Add QA, Ops, Marketing
  ];
  await db.insert('agents').values(agents);
}
```

**AgentRole type consistency:**
- `forest/agents/types.ts`: `AgentRole = 'CEO' | 'Developer' | 'QA' | 'Ops' | 'Marketing'`
- `seed/db/types.ts`: `AgentDbRow.role` should match
- If DB ENUM constraint only allows CEO/Developer, need migration to add new values (⚠️ requires careful data migration)

---

## Related Code Files

- `src/forest/agents/seed-default-team.ts` — main seeding function (may be re-exported from tree)
- `src/tree/agents/seed-default-team.ts` — likely re-export
- `src/forest/agents/types.ts` — AgentRole enum/type
- `src/seed/db/types.ts` — AgentDbRow interface
- `migrations/` — any agent-related migrations (e.g., `0016-agent-factory.sql`)
- `src/seed/auth/openclaw-token.ts` — org creation via token
- `src/app/actions/auth.ts` or `src/land/auth/*` — web signup flow

---

## Implementation Steps

### Step 1: Find and read current seedDefaultTeam

```bash
grep -rn "seedDefaultTeam" src/ | head
```

Read the implementation. Identify:
- Where it's defined
- Which roles are currently seeded
- Where it's called (org creation hooks)

### Step 2: Check AgentRole type

Open `src/forest/agents/types.ts`:
```typescript
export type AgentRole = 'CEO' | 'Developer' | 'QA' | 'Ops' | 'Marketing';
```

If QA/Ops/Marketing already present → proceed. If not, add them.

Also check `src/seed/db/types.ts`:
```typescript
export type AgentDbRow = {
  role: AgentRole; // or separate union?
  // ...
};
```

If DB row type is `'CEO' | 'Developer'` only, need to **align**:
- Option A: Expand DB type to match (requires migration if ENUM constraint)
- Option B: Restrict AgentRole to CEO/Developer for now, but document QA/Ops/Marketing as future (would break default seeding)

**Recommendation:** Check if `agents.role` column has CHECK constraint or ENUM. If so, plan migration. If free text (VARCHAR), just expand type.

### Step 3: Add QA, Ops, Marketing to seeding

Modify `seedDefaultTeam()`:
```typescript
const agents: Array<{
  role: AgentRole;
  name: string;
  systemPrompt: string;
  // ...
}> = [
  { role: 'CEO', name: 'CEO Agent', systemPrompt: DEFAULT_CEO_PROMPT },
  { role: 'Developer', name: 'Developer Agent', systemPrompt: DEFAULT_DEV_PROMPT },
  { role: 'QA', name: 'QA Agent', systemPrompt: DEFAULT_QA_PROMPT },
  { role: 'Ops', name: 'Ops Agent', systemPrompt: DEFAULT_OPS_PROMPT },
  { role: 'Marketing', name: 'Marketing Agent', systemPrompt: DEFAULT_MARKETING_PROMPT },
];
```

Prompts can be minimal; they can be refined later. Example:
```typescript
const DEFAULT_QA_PROMPT = `You are the QA agent for Sophia AI Factory. Your job is to review code, test plans, and ensure quality standards are met.`;
```

### Step 4: Verify org creation hooks

Find all places creating orgs:

```bash
grep -rn "insert.*organizations\\|createOrg" src/ | grep -v test
```

Likely locations:
- `src/app/actions/auth.ts` — web signup
- `src/seed/auth/openclaw-token.ts` — token-based org creation

Ensure after org insert, `await seedDefaultTeam(orgId)` is called.

If OpenClaw path missing, add it:
```typescript
// After inserting org
await seedDefaultTeam(newOrgId);
```

### Step 5: Run tests

```bash
npm test -- src/forest/agents/__tests__/ src/tree/agents/__tests__/
```

Check for agent-related tests. May need to update test fixtures to expect 5 agents instead of 2.

### Step 6: Manual verification

Start dev server and sign up a new org:
```bash
npm run dev
# Visit /signup, create account
# Check DB: SELECT * FROM agents WHERE org_id = ?
# Should see 5 rows with roles CEO, Developer, QA, Ops, Marketing
```

Or trigger OpenClaw token flow and verify.

---

## Success Criteria

- `seedDefaultTeam()` creates 5 agents (CEO, Developer, QA, Ops, Marketing)
- All org creation paths call `seedDefaultTeam()`
- `AgentRole` type includes all 5 roles consistently across codebase
- Tests updated/verified (if they check team size)
- No type errors after changes

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| DB ENUM constraint rejects new roles | Medium | High | Check current schema; if ENUM, create migration to add values |
| Existing code assumes only 2 roles | Medium | Medium | Search for `if (role === 'CEO')` patterns; ensure new roles handled gracefully |
| Tests brittle on agent count | Low | Low | Update test fixtures to accept 5 agents |
| OpenClaw flow missed | Low | Medium | Code review; add test for token flow seeding |

---

## Security Considerations

- **Default prompts:** Should not leak internal system info; keep generic
- **Agent permissions:** All agents initially have same permissions (read-only C-Level); no escalation
- **Team composition:** CEO only can modify agents (ensure proper checks in update flows)

---

**END OF PHASE 02**
