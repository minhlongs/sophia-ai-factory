# Phase 29 — `getErrorMessage()` Sweep Wave 3 (`src/lib/{gateway,billing,inngest,telegram}/**`)

**Status:** 🚧 IN PROGRESS (2026-04-24)
**Priority:** P2 (DRY sweep — FINAL wave, closes Phase 26→27→28→29 series)
**Plan Parent:** `plans/260419-2121-triet-tieu-no-ky-thuat/plan.md`

## Scope

Replace `err instanceof Error ? err.message : String(err)` ternary with `getErrorMessage(err)` in **4 `src/lib/**` files**. Mechanical, behavior-preserving, closes the ternary sweep.

## Why

Phase 27 Wave 1 (9.8/10) + Phase 28 Wave 2 (9.7/10) shipped clean. Wave 3 is the remaining 4 hits across `gateway/`, `billing/`, `inngest/`, `telegram/` — the last of the `err` ternary pattern.

## Approach

For each file:
1. Add `import { getErrorMessage } from '@/lib/utils/to-error'`.
2. Replace ternary expression → `getErrorMessage(err)`.
3. Preserve surrounding variable shape / template literal / logger call.

## Target Files (4)

| File | Hits | Pattern |
|------|------|---------|
| `src/lib/gateway/openclaw-gateway.ts` | 1 | `lastError = ...` assignment |
| `src/lib/billing/nowpayments-ipn-handlers.ts` | 1 | inline logger `error: ...` |
| `src/lib/inngest/functions/generate-campaign.ts` | 1 | `const errMsg = ...` |
| `src/lib/telegram/telegram-client.ts` | 1 | template literal `${...}` |
| **Total** | **4** | |

## Non-Goals

- Non-`err` identifier residuals flagged by code-reviewer (Phase 28): `cron/uptime-check/route.ts`, `cron/usage-export/route.ts`, `admin/api-keys/route.ts` → Phase 30 cleanup pass
- `toError()` semantics change
- Error-response shape change

## Success Criteria

- [ ] `npm run build` — 0 new TS errors (baseline 611)
- [ ] `npm test` — 1321 baseline still green
- [ ] `npm run lint` — 0 new warnings on touched files
- [ ] 0 remaining `err`-pattern ternary matches under `src/lib/{gateway,billing,inngest,telegram}/**`
- [ ] Code review ≥ 9.5/10 APPROVE SHIP
- [ ] CI GREEN + Production HTTP 200

## Risk Assessment

- **Risk:** VERY LOW. Same mechanical transform as Phase 27 & 28.
- **Backward-compat:** N/A (string output identical for `Error` shape; slight improvement for PostgrestError shapes).
- **Rollback:** single-commit revert.

## Deferred (Phase 30+)

- Non-`err` identifier residuals (~4 hits in 4 api route files flagged by Phase 28 reviewer)
- `lib/usage-metering/types.ts` (283L > 200L) modularization
- `ClientWithStorage` → R2 migration
- `raas_licenses` D1-vs-Supabase audit
