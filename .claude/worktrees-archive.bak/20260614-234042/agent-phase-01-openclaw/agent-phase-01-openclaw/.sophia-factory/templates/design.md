---
template: design
phase: 2-design
version: "1.0"
---

# Design: {Title}

> Fill all sections before handing to Phase 3 (Code). No ambiguity allowed at handoff.

## Meta

| Field | Value |
|-------|-------|
| Date | {YYYY-MM-DD} |
| Requirement | `plans/{slug}/requirement.md` |
| Designer | CTO agent / sophia-orchestrator |
| Status | draft / approved |

## Architecture Decision

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Data layer | New D1 table / Existing table / No DB | {why} |
| API surface | Server Action / Route handler (webhook/cron only) | {why} |
| Auth gate | Public / Auth required / Tier: {TIER} | {why} |
| Runtime | CF Worker Edge / Node (not CF) | {why} |
| State | Client / Server / Hybrid | {why} |

## Data Model

### New Tables (if any)

```sql
-- {table_name}
CREATE TABLE {table_name} (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  -- {columns}
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### Modified Tables (if any)

```sql
ALTER TABLE {table_name} ADD COLUMN {column} {type};
```

### No DB changes: {reason}

## API Design

### Server Action (preferred for mutations)

```ts
// src/lib/{feature}/{action-name}.ts
"use server"
export async function {actionName}(input: {InputType}): Promise<{ReturnType}> {
  // zod validate input
  // getCurrentUser()
  // getUserTier() — check gate
  // createServerClient() — sync, no await
  // business logic
}
```

### Route Handler (webhooks/crons only)

```
POST /api/{feature}/{action}
Auth: {Bearer token / CRON_SECRET / public}
Request: { schema }
Response: { schema }
```

## Component Breakdown

### Files to Create

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/lib/{feature}/{module}.ts` | {purpose} | {N} |
| `src/app/(app)/{feature}/page.tsx` | {purpose} | {N} |
| `tests/unit/{module}.test.ts` | {purpose} | {N} |

### Files to Modify

| File | Change | Impact |
|------|--------|--------|
| `src/middleware.ts` | {what changes} | {impact} |
| `src/config/tiers.ts` | {what changes} | {impact} |

> All files must be < 200 LOC. Split now if estimate exceeds limit.

## Data Flow

```
{ASCII diagram or description}

Example:
User clicks → Server Action → zod validate → getCurrentUser() → getUserTier()
→ tier gate (403 if wrong tier) → createServerClient() → D1 query → return data
```

## UX Design

### Screen States

| State | Description | Component |
|-------|-------------|-----------|
| Loading | {description} | `<Skeleton>` or spinner |
| Empty | {description} | Empty state with CTA |
| Success | {description} | {component} |
| Error | {description} | Error boundary fallback |

### i18n Keys

Add to `apps/sophia-ai-factory/messages/{locale}.json`:
```json
{
  "{feature}": {
    "{key}": "{VN value}",
    "{key}_en": "{EN value}"
  }
}
```

## Security Checklist

- [ ] Zod schema defined for all inputs
- [ ] Auth gate verified (`getCurrentUser()` called first)
- [ ] Tier gate tested (wrong tier → 403)
- [ ] No secrets in client-side code
- [ ] Setup Wizard / Telegram / NOWPayments unaffected
- [ ] D1 RLS not bypassed
- [ ] New env vars documented (not committed)

## New Environment Variables

| Variable | Where set | Purpose |
|----------|-----------|---------|
| `{VAR_NAME}` | CF Dashboard → Secrets | {purpose} |

---
*Template version 1.0 — Sophia AI Factory Phase 2 Design*
