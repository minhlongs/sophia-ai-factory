# Code Review: B2 Phase 15 — coupons/activate/route.ts

**Date:** 2026-04-26 08:53
**Reviewer:** code-reviewer agent
**Phase:** B2 TypeScript TS18046 Cleanup — Phase 15
**File:** `src/app/api/coupons/activate/route.ts`
**Pattern:** HTTP Boundary Type Cast — Sub-Variant 2 (Request-Body), instance #9

---

## Score: 9.8/10

**Decision:** AUTO-APPROVED (>= 9.5 threshold, 0 critical issues)

---

## Summary

| Metric | Value |
|---|---|
| Files changed | 1 |
| LOC diff | ~6 (4 added, 1 modified, 1 unchanged at L41) |
| Critical issues | 0 |
| Major issues | 0 |
| Minor issues | 1 |
| Style nits | 0 |
| Pre-existing concerns flagged | 1 (not introduced by Phase 15) |

---

## Pattern Fidelity vs Phase 14 (instance #8)

VERIFIED. Phase 15 is a faithful clone of Phase 14 pattern.

| Aspect | Phase 14 (apply) | Phase 15 (activate) | Match |
|---|---|---|---|
| Interface placement | After imports, before constants | After imports, before constants | ✓ |
| Field optionality | All `?: string` | All `?: string` | ✓ |
| Cast site | `(await request.json()) as X` | `(await request.json()) as X` | ✓ |
| Truthiness guards | `(body.code \|\| '').trim()...` preserved | `(body.coupon \|\| '').trim()...` preserved | ✓ |
| Naming convention | `CouponApplyRequest` | `CouponActivateRequest` | ✓ |
| Defensive default | `body.tier \|\| 'BASIC'` | `body.tier \|\| 'MASTER'` | ✓ (route-appropriate) |

Pattern adherence is exact. Sub-Variant 2 documentation entry in `docs/code-standards.md` L201–208 should be updated post-merge to reflect "2 instances" (currently states "1 Instance").

---

## Type Safety Review

### Interface Definition (L13–16)
```typescript
interface CouponActivateRequest {
  coupon?: string;
  tier?: string;
}
```

Both fields correctly `?: string`:
- `coupon` — caller (pricing-section.tsx L56) sends `"FREE50"` literal but interface allows undefined for defensive parsing
- `tier` — caller sends `tier` from selection state (string), undefined-safe via `body.tier || 'MASTER'` fallback at L47
- Field names match caller payload exactly: `JSON.stringify({ coupon: "FREE50", tier })` at pricing-section.tsx L56

Interface is minimal (2 fields, no over-engineering). YAGNI compliant.

### Cast Site (L45)
```typescript
const body = (await request.json()) as CouponActivateRequest;
```

- Cast is narrowest scope (single expression, no variable hoisting)
- Type assertion replaces previous implicit `any` from `.json()` return
- Downstream property access (`body.coupon`, `body.tier`) is now type-checked
- No `as unknown as X` double-cast hack — direct assertion is type-compatible

---

## Runtime Safety Review

Defense-in-depth preserved:
- L46: `(body.coupon || '').trim().toUpperCase()` handles undefined/null/empty
- L47: `(body.tier || 'MASTER').toUpperCase()` defaults to MASTER tier
- L49–52: Coupon validity check (`VALID_COUPONS[coupon]`) before any DB writes
- L54–57: D1 availability check before queries
- L101–103: try/catch wraps full handler

Type cast does NOT remove runtime guards — interface is structural assertion only, not runtime validation. Correct layering: TypeScript catches dev-time misuse, `||` fallbacks catch runtime malformed input.

---

## YAGNI / KISS / DRY Compliance

- **YAGNI:** Interface has only 2 fields, both consumed. No speculative `metadata`, `userId`, or extras. ✓
- **KISS:** Single inline cast, no helper function, no Zod schema (request shape is trivial 2-string). ✓
- **DRY:** Sub-Variant 2 pattern documented in code-standards.md; this is the second canonical instance reinforcing the standard, not duplicating logic. ✓

---

## Edge Case Scout Findings

Scouted callers/dependents of `/api/coupons/activate`:

1. **`src/components/pricing/pricing-section.tsx` L53–66** — primary caller
   - Sends `{ coupon: "FREE50", tier }` POST body
   - Field names match interface ✓
   - Hardcoded coupon literal "FREE50" — typed against `coupon?: string` is compatible
   - Response handler at L58 uses `as CouponActivateResponse` — separate symmetric pattern, out of scope for Phase 15

2. **`src/app/[locale]/login/page.tsx` L47** — redirect path
   - Uses `/api/coupons/activate-redirect` (different route), NOT `/api/coupons/activate`
   - No interface conflict ✓

3. **No other callers found** — surface area is minimal, low blast radius

4. **Auth boundary (L40–43)** — unchanged, `getCurrentUserFromHeaders` returns `User | null`, properly narrowed

5. **D1 binding lookup (L30–36)** — unchanged, returns `D1Database | null`, null-checked at L55

6. **Auto-create org branch (L67–77)** — defensive logic preserved, `payload.email` cast as `string` with `'user'` fallback

7. **Subscription upsert (L80–88)** — INSERT/UPDATE branches preserved

8. **Race conditions:** No new race introduced. Pre-existing race window between `SELECT id FROM subscriptions` (L80) and INSERT/UPDATE (L83/L86) is concurrency-not-handled, but pre-existing — flag as future tech debt only.

---

## Minor Issue (1)

### M1: Documentation update needed post-merge
- **Severity:** Minor (docs-only)
- **File:** `docs/code-standards.md` L201
- **Issue:** Header reads "Sub-Variant 2: Request-Body Type Cast (1 Instance)" — should become "(2 Instances)" after Phase 15 merges
- **Fix:** Update count, add Phase 15 line under "Canonical Examples" listing `coupons/activate/route.ts`
- **Action:** Defer to post-merge docs sync (not blocking)

---

## Pre-existing Concern (Flagged, Not Introduced by Phase 15)

### P1: Generic 500 error swallows specifics
- **Location:** L101–103 `catch (e) { return NextResponse.json({ success: false, error: toError(e).message }, { status: 500 }); }`
- **Note:** The plan's framing "swallowing network errors and returns generic 500" is partially accurate — `toError(e).message` does propagate the underlying error message to the client. This may leak internal details (D1 error text, stack frames) to the client. However, this pattern is project-wide and pre-existing (not introduced by Phase 15).
- **Material?** No, not material for Phase 15 scope. Flag as future hardening candidate (consider error code mapping + structured logging).
- **Action:** Defer.

---

## Regression Risk Assessment

| Risk | Status |
|---|---|
| Coupon activation flow break | None — runtime guards unchanged, interface matches caller payload |
| Auth break | None — `getCurrentUserFromHeaders` untouched |
| D1 query break | None — query strings + bindings untouched |
| Org auto-create break | None — branch logic untouched |
| MCU bonus calculation break | None — `couponDef.mcuBonus` arithmetic untouched |
| Protected flow impact | None — coupon system NOT in Sophia's 3 protected flows |

---

## Compliance Matrix

| Standard | Status |
|---|---|
| Zero `:any` types added | ✓ Cast uses named interface |
| HTTP Boundary Cast pattern (code-standards.md) | ✓ Sub-Variant 2 conformant |
| File size < 200 lines | ✓ 104 lines |
| YAGNI / KISS / DRY | ✓ All three |
| Phase 14 pattern fidelity | ✓ Exact clone modulo route-specific defaults |
| Tier enum compliance | ✓ Uses `MASTER` default (uppercase) |
| Caller payload alignment | ✓ Field names match `pricing-section.tsx` L56 |

---

## Recommended Actions

1. **Auto-approve and proceed to commit** — score 9.8/10, 0 critical/major
2. **Post-merge:** Update `docs/code-standards.md` L201 from "(1 Instance)" → "(2 Instances)" and append Phase 15 example line (M1)
3. **Backlog (defer):** Consider structured error responses for L101–103 catch block (P1) — project-wide hardening, not Phase 15 scope
4. **Backlog (defer):** Consider transaction-wrapping subscription upsert L80–88 to eliminate SELECT/INSERT race window — pre-existing tech debt

---

## Metrics

| Metric | Value |
|---|---|
| Type Coverage (file) | 100% (no `any`, no implicit unknown) |
| Lines added | 4 (interface) |
| Lines modified | 1 (L45 cast) |
| Net LOC | +5 |
| TS18046 errors fixed | 2 (per phase plan target) |
| Test coverage delta | 0 (no test changes — runtime semantics unchanged) |

---

## Unresolved Questions

1. Should the `docs/code-standards.md` update for Sub-Variant 2 instance count (1 → 2) be batched with this merge or handled in a separate docs-sync commit?
2. Pre-existing P1 (catch block leaks `toError(e).message` to client) — is there a project-wide ticket for structured error responses, or should one be opened?
3. Pre-existing subscription upsert race (L80–88) — acceptable for current low-traffic coupon flow, but worth tracking for ENTERPRISE/MASTER tier surge scenarios. Open tech-debt ticket?

---

**Final Verdict:** AUTO-APPROVED 9.8/10. Pattern instance #9 is canonical, type-safe, runtime-safe, and YAGNI-compliant. Ship it.
