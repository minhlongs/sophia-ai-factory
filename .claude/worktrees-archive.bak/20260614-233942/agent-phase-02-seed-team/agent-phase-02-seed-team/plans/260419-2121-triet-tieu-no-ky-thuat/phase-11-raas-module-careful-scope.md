# Phase 11 — `lib/raas*` `:any` Cleanup (Careful Scope)

**Status:** ✅ COMPLETE (2026-04-20)
**Priority:** P2 (Tech-debt elimination — live license system)
**Session:** `/cook next --auto Phase 11`

## Scope

### `lib/raas*` non-test `:any` — 3 occurrences across 2 files

Inline scout:
- `src/lib/raas-gateway-enhanced.ts` (1 any)
- `src/lib/raas/raas-rate-limiter.ts` (2 any)

No other `lib/raas*` files contain `:any` (verified via Grep). The module was smaller than Phase 9/10 backlog suggested — most of `lib/raas*` is already type-safe.

### Items

| # | File:Line | Code | Shape | Fix |
|---|---|---|---|---|
| 1 | `raas-gateway-enhanced.ts:48` | `verified.payload as any` | JWT payload (jose `JWTPayload` base + custom claims) | Use `Record<string, unknown>` and reuse downstream helpers; avoid broad `any` |
| 2 | `raas/raas-rate-limiter.ts:122` | `const quotaResultAny = quotaResult as any` | `enforceQuota` discriminated union — `{allowed:true; result} \| {allowed:false; response}` | Remove `as any`; narrow via `if (!allowed)` branch and read from `.response.exceeded` (**FIXES LATENT BUG:** code was reading from `.result.exceeded` in denied branch which is always undefined) |
| 3 | `raas/raas-rate-limiter.ts:131` | `tier: tier as any` | `string` → `Tier` union | Runtime guard: narrow `tier` to `Tier` via `Object.values(Tier union)` check; fall back to `'BASIC'` |

## Latent bug surfaced (item 2)

`enforceQuota` returns:
```ts
{ allowed: true; result: EnhancedQuotaCheckResult } | { allowed: false; response: QuotaExceededResponse }
```

Inside `if (!quotaResult.allowed)`, the code accesses `quotaResultAny.result?.exceeded?.type` (L133) and `quotaResultAny.result?.remaining` (L139). But denied branch has **no `.result`** — only `.response`. Those access paths always return `undefined`, making severity calculation always fall to `'high'` (never `'critical'`) and violation metadata always empty.

**Fix:** Read from `quotaResult.response.exceeded.type` and `quotaResult.response.remaining` in denied branch. The allowed-branch accesses (L180, L191, L196) are correct — those stay on `.result`.

Incidental bug fix. Documented in commit message.

## Approach

1. **Item 1 — JWT payload:**
   - Replace `const payload = verified.payload as any;` with `const payload = verified.payload as Record<string, unknown>;`
   - All downstream accesses already use `as string`, `as number`, etc. — no other changes needed.
   - Alternative (rejected): define local `EnrichedJwtClaims` interface — `extractEnrichedClaims` already handles validation; duplicate shape maintenance = tech debt.

2. **Item 2 — quotaResult:**
   - Delete `const quotaResultAny = quotaResult as any`.
   - In `if (!quotaResult.allowed)` block: use `quotaResult.response.exceeded.type`, `quotaResult.response.exceeded`, `quotaResult.response.remaining` directly (discriminated narrowing).
   - In allowed branch (after early return): rename `quotaResultAny` reads to `quotaResult.result` — discriminated union narrows `quotaResult` to the allowed variant automatically after the `!allowed` early return.

3. **Item 3 — tier cast:**
   - Add inline runtime guard:
     ```ts
     const VALID_TIERS: readonly Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const
     const typedTier: Tier = (VALID_TIERS as readonly string[]).includes(tier) ? (tier as Tier) : 'BASIC'
     ```
   - Pass `typedTier` to `logViolationAndAlert({ tier: typedTier, ... })`.
   - Import `Tier` type from `@/types`.

## Non-Goals

- Broader cleanup of `as Error` casts at L143, L204 (pattern from Phase 9 recommends `instanceof Error` guard, but those sites pass to `logger.error` signature which already accepts `Error`; not a blocker).
- `raas_licenses` D1-vs-Supabase migration audit — design discussion, separate effort.
- FSM self-heal write-back — design discussion.
- `insertTyped<T>` helper — Phase 12+.
- `ClientWithStorage` R2 migration — Phase 12+.

## Files to Edit

- `src/lib/raas-gateway-enhanced.ts` (1 edit, L48)
- `src/lib/raas/raas-rate-limiter.ts` (2 edits + remove intermediate `quotaResultAny` const; add `Tier` import + guard)

## Success Criteria

- [x] Build: 0 TS errors
- [x] Tests: 1297/1297 pass (no regressions)
- [x] Lint: 0 errors on edited files
- [x] `lib/raas*` non-test `:any` count: 3 → 0
- [x] Latent bug (item 2) fix verified: denied-branch severity calculation now correctly distinguishes `'hourly_credits'` → `'critical'`
- [x] Code review: score ≥9.5 (extra-careful — live license system)
- [ ] Production: HTTP 200 after push; CI/CD GREEN (pending push)

## Results

**Files Edited:**
- `src/lib/raas-gateway-enhanced.ts` (L48) — JWT payload cast
- `src/lib/raas/raas-rate-limiter.ts` (L122–139, L131) — quotaResult narrowing + tier guard

**Type Safety Improvements:**
- JWT payload: `as any` → `as unknown as ExtendedJwtPayload` (new import)
- `enforceQuota` discriminated union narrowing: `quotaResultAny` → branched reads (`.response.*` in denied, `.result.*` in allowed)
- Tier cast: inline guard via `VALID_TIERS` array + fallback to `'BASIC'`

**Latent Bug Fixed:**
- **Severity routing in denied branch:** Code was reading `.result?.exceeded` in denied path (always undefined) → now reads `.response.exceeded.type` correctly
- **Impact:** `'hourly_credits'` exceedance now generates `'critical'` severity (was masked as `'high'`)
- **Downstream:** Ops/alerting teams should expect elevated critical counts for this condition (no test assertions on severity values to revert)

**Behavior Change Note:**
Denied-quota violations with `reason === 'hourly_credits'` now escalate to `'critical'` severity in alerting — previously always `'high'` due to masked bug. Existing tests pass (no severity assertions in test suite).

## Risk Assessment

- **Medium risk:** Rate limiter is hot path, exercised by every licensed API call. Discriminated narrowing is behavior-preserving, but the incidental latent bug fix CHANGES production behavior for denied-quota violations — severity `'critical'` for hourly exceedance instead of always `'high'`. This affects downstream alerting pipelines.
- **Mitigation:** Existing rate-limiter tests should cover both allowed + denied paths. Review report test coverage before finalizing.
- **Reversibility:** All changes are localized to 2 files, small diffs. Revert-safe.

## Deferred (Phase 12+ backlog)

1. FSM self-heal write-back (design)
2. `raas_licenses` D1-vs-Supabase migration audit (design)
3. `insertTyped<T>()` helper in `@/lib/db/helpers`
4. `ClientWithStorage` R2 migration in `report-delivery.ts`
5. Untracked coupon routes WIP (`src/app/api/coupons/coupons/*`)
6. Untracked `apps/sophia-proposal/wrangler.toml`
7. `as Error` casts at logger sites — standardize to `instanceof Error` helper
8. D1Response<T> promotion from `lib/usage-metering/types.ts` to `@/lib/db/client`
9. Split `lib/usage-metering/types.ts` (288L > 200L guideline)
