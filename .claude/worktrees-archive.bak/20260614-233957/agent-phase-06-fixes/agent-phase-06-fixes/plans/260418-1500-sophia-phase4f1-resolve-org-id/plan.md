---
name: Sophia Phase 4F.1 resolveOrgId Unification
status: shipped
priority: P2
estimate: 1h
session: PM-15 2026-04-18
parent: 260418-1400-sophia-phase4f-cache-wiring (Phase 4F shipped ea0e8ca7)
commit: 9c34c3b
shipped_at: 2026-04-18
final_tests: 1180/1180
review_score: 9.7/10
---

# Phase 4F.1 — resolveOrgId Unification

Addresses LOW-1 deferred item from Phase 4F review. Eliminates the
`orgId ?? ''` sentinel + sync-idiom drift flagged in Phase 4F review.

## Scope

Extract the duplicated `async resolveOrgId(userId): Promise<string|null>`
from 2 identical callsites (`api/raas/workflows/route.ts:39-50` +
`api/raas/workflows/[id]/route.ts:28-39`) into a shared helper.

Thread the helper into the Inngest campaign path so the LLM cache
key uses real `org_id` (from `org_members`) instead of bare `userId`.

## Phases

| Phase | File(s)                                                  | Status |
|-------|----------------------------------------------------------|--------|
| 1     | `lib/auth/resolve-org-id.ts` (new, <80 LOC)              | done   |
| 1     | `lib/auth/resolve-org-id.test.ts` (new, 4 tests)         | done   |
| 2     | `app/api/raas/workflows/route.ts` (import helper)        | done   |
| 2     | `app/api/raas/workflows/[id]/route.ts` (import helper)   | done   |
| 3     | `lib/inngest/functions/generate-campaign.ts:104`         | done   |

## Out of scope

- `get-user-tier.ts` org_members lookup (bundled with tier fetch;
  refactor has no reward and adds risk — Idiom #2 stays intact there)
- `missions`, `usage`, `coupons/activate*`, `db/auth.ts` (Idiom #1
  user.id-as-orgId is consistent within their own read/write; changing
  would be a data-regression risk with zero cache-correctness benefit)
- Idiom #3 (`workflow.org_id` denormalized) — already resolved; not
  the same category

## Success criteria

- Helper unit-tested: (member found / not found / empty userId / D1 throws)
- `workflows` routes still pass existing tests (behavior unchanged)
- Inngest cache key now resolves real `org_id` when user is in `org_members`
- Tests 1175 → 1179+ (added ≥4 tests)
- `npx tsc --noEmit` clean
- Code review ≥9.5 (auto-ship threshold)
- Rule #0: push → CI green → prod HTTP 200 + shortSha match

## Locked decisions (auto-mode)

- **Return type:** `Promise<string | null>` — matches existing idiom.
  Callers that need fallback use `?? userId`.
- **D1 acquisition:** `getD1Raw()` walker extracted too, same module.
  Keeps the 2 workflows routes at -13 LOC each.
- **Inngest fallback:** `(await resolveOrgId(userId)) ?? userId` preserves
  current behavior for users NOT in `org_members`. Zero-change for
  single-tenant callers; real org_id for multi-tenant.
- **Env gate:** Cache gate (`LLM_CACHE_ENABLED`) still OFF in prod —
  this is pure refactor + scope extension of the same dark-launch.

## Rollback

- Zero D1 changes
- Helper is a pure extraction + 1-line Inngest change
- `git revert` single commit

## Risk

- Inngest callers in `org_members` will get different cache keys than
  before (org_id vs user_id). Safe because cache is empty in prod
  (env OFF) — no live cache rows to orphan.

## Shipped

**Commit:** `9c34c3b`

**Migrated callers (4 total):**
- `app/api/raas/workflows/route.ts`
- `app/api/raas/workflows/[id]/route.ts`
- `lib/inngest/functions/generate-campaign.ts`
- `src/app/[locale]/dashboard/workflows/[id]/page.tsx` (scope extension: reviewer discovered 4th byte-identical copy in dashboard SSR, also migrated in same commit)

**Test delta:** +5 tests (1175 → 1180)

**Note:** Scope extension accepted — same refactor pattern, unifies all `resolveOrgId` callers in one pass, completing the idiom consolidation.
