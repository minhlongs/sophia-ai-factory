# Sophia R5 — Phase 4F.2: getTenantContext helper

**Status:** shipped
**Commit:** `0172fa2`
**Shipped at:** 2026-04-18 (post-R4 same day)
**Mode:** `/cook all step by step --auto` (R5 item 4/5)
**Origin:** Phase 4F.1 memory note "absorbing get-user-tier + resolveOrgId"

## Finding (updated after scan)

Zero files currently use both `resolveOrgId` AND `getUserTier` — meaning
no existing caller is paying the double-roundtrip cost today. BUT:

- `getUserTier(userId)` runs `SELECT org_id FROM org_members ...`
  *internally*, then does a second `SELECT plan FROM subscriptions`.
- If a caller later wants BOTH orgId + tier it pays 3 roundtrips
  (getUserTier internal × 2 + resolveOrgId × 1).

## Scope (YAGNI-sized)

- **Add** `getTenantContext(userId)` → `{ orgId, tier }` via **one** JOIN
- **Keep** `resolveOrgId` + `getUserTier` unchanged (no forced migration)
- Future callers that need both adopt `getTenantContext` → 1 roundtrip
- No bulk churn. Old helpers remain idiomatic for single-value lookups.

## File ownership

### New
- `src/lib/auth/get-tenant-context.ts` (~60 LOC) — pure helper + unit
- `src/lib/auth/get-tenant-context.test.ts` (~80 LOC) — 6-7 tests

### Not modified
- No existing callers migrated (refactor when real demand appears)

## Test matrix (+~7)

- null userId → returns null
- D1 unavailable → null (defense-in-depth)
- User not in org_members → null
- User in org_members + no active subscription → `{ orgId, tier: 'BASIC' }`
- User in org_members + active subscription → `{ orgId, tier: <plan> }`
- D1 throw → null (swallow)
- Verifies single D1 JOIN (observability via prepare.mock.calls length)

## Rule #0 Verification Report
- Build: ✅ exit 0
- Tests: ✅ 1242 → 1249 (+7)
- Git Push: ✅ `0172fa2` → main
- CI/CD: ✅ GitHub Actions green
- Deploy: ✅ CF Pages success
- Production: ✅ HTTP 200 + shortSha match
- Code Review: ✅ 9.7/10 SHIP (0 critical)
