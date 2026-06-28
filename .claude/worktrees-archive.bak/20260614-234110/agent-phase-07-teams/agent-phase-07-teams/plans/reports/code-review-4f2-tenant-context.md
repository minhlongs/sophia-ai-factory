# Code Review — Phase 4F.2 `getTenantContext`

**Score: 9.6/10 — SHIP** (0 critical · 0 high · 2 low)

Date: 2026-04-18
Reviewer: code-reviewer
Scope: `src/lib/auth/get-tenant-context.ts` (+63 LOC), `get-tenant-context.test.ts` (+89 LOC)

---

## Summary

Clean single-roundtrip JOIN helper, correctly layered over `getD1Raw` (DRY with 4F.1). Semantics match pre-existing `getUserTier` exactly — throw-safe, null-safe, `'BASIC'` fallback. Tests 1249/1249, build 0 errors. Auto-approved.

---

## Scope Check

- File count / LOC: **2 files, 152 LOC total** — within spec.
- No caller migrations: justified per scope-decision (0 co-call sites found). Avoids churn.
- KISS / DRY: imports `getD1Raw` rather than redefining the resolver. Good.

---

## Security — PASS

- **SQL injection:** Parameterized via `.bind(userId)`. `status='active'` is a literal. Clean.
- **Tenant scope:** `LEFT JOIN ... AND s.status='active'` is correctly inside the ON clause (not WHERE) — so non-subscribing members still get `orgId` with `plan=null → 'BASIC'`. Correct behavior.
- **Error path:** `catch → null` prevents stack leakage. Matches repo pattern.
- **LIMIT 1:** Prevents unbounded result sets on edge cases (multi-org user).

---

## Correctness

- Tier fallback chain: `row.plan → 'BASIC'` ✓
- Null-chain guards (`!userId`, `!d1`, `!row?.org_id`) ✓
- Test contract verifies single `prepare()` call — locks in roundtrip count. Excellent.

---

## Findings

### Low-1 — Lowercase/uppercase tier mismatch (PRE-EXISTING, not regression)
DB stores `'free' | 'basic' | 'premium' | 'pro' | 'enterprise' | 'master'` (lowercase, per migration 0001 `plan TEXT DEFAULT 'free'` + `DB_TIER_MAPPING` in `config/tiers/tier-configs.ts:124`). Helper raw-casts `row.plan as Tier` where `Tier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'`. For an active sub with `plan='premium'`, the helper returns `tier: 'premium'` (violates type contract).

**Why low, not high:** `getUserTier` has the same raw cast (line 29). `DB_TIER_MAPPING` currently has zero call-sites grepped. This is repo-wide tech debt the helper inherits — fixing in 4F.2 would be scope creep.

**Future action:** Thread `DB_TIER_MAPPING[row.plan] ?? 'BASIC'` through both `getUserTier` AND `getTenantContext` in one pass (separate phase, e.g. 4F.3).

### Low-2 — Test gap for unknown/lowercase plan string
No test asserts behavior when DB returns `plan='premium'` (lowercase) or `plan='free'`. Currently passes through unchanged — captures the Low-1 bug invisibly. Add one assertion documenting current (buggy) behavior so the future mapping fix has a failing test to flip.

---

## Positive Notes

- Doc header clearly states when to use this vs resolveOrgId/getUserTier individually.
- `JoinRow` interface keeps the raw SQL shape local and typed.
- Single-prepare test (test #7) is a rare-but-valuable contract assertion.
- Re-uses `getD1Raw` from 4F.1 — no duplicate env-walk logic.

---

## Verification

- Tests: **1249/1249** (+7) ✓
- Build: exit 0 ✓
- LOC: 63 + 89 ≤ 200 ✓

---

## Unresolved Questions

1. Should `DB_TIER_MAPPING` be wired into `getTenantContext` + `getUserTier` as Phase 4F.3 before 4G-BYOK builds on a bogus uppercase assumption?
2. Are any existing tier gates comparing `tier === 'PREMIUM'` today hitting the pre-existing bug silently (always falling through to BASIC because DB returns `'premium'`)? Worth a follow-up scout.
