# Phase 5 Code Review: console.log Cleanup

**Date:** 2026-04-20
**Scope:** 17 src files + 1 test file (console.* → logger.*)
**Verdict:** **APPROVE_WITH_NITS** (8.5/10)

## Signature Correctness ✓
Verified `logger.error(msg, error?, metadata?)` signature. Sampled `worker/index.ts`, `worker/lib/kv-license-cache.ts`, `raas-auth-middleware.ts`, `auth/[...all]/route.ts`, `referral/*/route.ts`, `byok/provider-router.ts`, `better-auth-server.ts`, `dashboard/page.tsx`. **All `logger.error` calls pass proper `Error` type.**

## Error Coercion ✓
Pattern `err instanceof Error ? err : new Error(String(err))` consistently applied across all 14 `logger.error` conversions. Zero raw `unknown` leaks → no runtime bugs.

## Printf-Style Conversion ✓
`byok/provider-router.ts` + `setup/local-mode/provision/route.ts`: `console.warn('[x] msg for userId=%s: %s', userId, err)` → `logger.warn(msg, { userId, error: String(err) })`. Semantic preserved — userId + error now in structured metadata (JSON-searchable in prod), message string decoupled from interpolated values. **Improvement over original.**

## Import Path ✓
All 17 files import from `@/lib/utils/logger-utility`. No typos.

## Skipped Files ✓
Verified via grep: `audit/compliance-receipt.ts`, `audit/right-to-erasure.ts`, `audit/cron-report-runner.ts`, `audit/crypto-utils.ts`, `audit/report-delivery.ts` — all remaining `console.*` are inside JSDoc `@example` blocks only. `logger-utility.ts`, `telemetry/logger.ts`, `enrichment-logger.ts` untouched (correct). `error.tsx` files untouched (Next.js convention — client error boundaries use console directly for browser DevTools).

## TypeScript ✓
Phase 5 diff introduces **zero new TS errors** (baseline: 10 pre-existing errors in touched files, unchanged post-diff).

## NITS (Low Priority)

1. **`env-validation.ts`**: `logger.warn('[env-validation] Missing or invalid environment variables')` followed by loop of per-issue warnings fragments context. Better: single `logger.warn(msg, { issues: result.error.issues.map(i => ({ path: i.path.join('.'), msg: i.message })) })`. Not blocking.

2. **`admin/users/page.tsx` + `campaigns/page.tsx` + `dashboard/page.tsx`**: `logger.error("[x] DB error", new Error(error.message))` — wrapping a string in `new Error()` loses original Supabase error fields (code, hint, details). Prefer passing as metadata: `logger.error(msg, undefined, { dbError: error })`. Minor observability loss.

3. **`setup/local-mode/provision/route.ts`**: Converted `console.warn` to `logger.warn`, but these are caught exception paths returning HTTP 500 — semantically these are errors, not warnings. Consider `logger.error(msg, err instanceof Error ? err : new Error(String(err)), { userId })`. Not blocking — preserves original level.

## Positive Observations
- Consistent error coercion pattern across all call sites
- Structured metadata replacing printf format strings = better observability
- Zero `:any` introduced; test file upgraded `as any` → `as Record<string, unknown>` (bonus improvement)
- All 5 skipped-file claims verified accurate
- No functional behavior change (fail-closed paths preserved)

## Unresolved Questions
None.
