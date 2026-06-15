# Phase 20 — `toError()` Slice 7 (final 46 sites)

**Status:** ✅ COMPLETE (2026-04-23)
**Priority:** P2 (Tech-debt polish — Phase 13→19 continuation, FINAL slice)
**Session:** CLOSED

## Scope

Seventh and **final** migration slice. 46 sites across 46 files — each file has exactly 1 `as Error` cast. After Phase 20 the only remaining `as Error` references in `src/` are:

- `src/lib/utils/to-error.ts:5` — documentation comment (not a cast)
- `src/lib/utils/logger-utility.ts:125,156` — union-type casts (overload typing — separate phase)
- `src/app/api/coupons/coupons/**` — untracked WIP, not part of this migration

### Target Files (46 sites, one each)

**API routes (20 files):**
- `src/middleware.ts`
- `src/app/actions/campaigns.ts`
- `src/app/api/ingestion/trigger/route.ts`
- `src/app/api/intelligence/score/route.ts`
- `src/app/api/admin/api-keys/[id]/route.ts`
- `src/app/api/admin/dunning/[licenseNonce]/suspend/route.ts`
- `src/app/api/admin/dunning/[licenseNonce]/route.ts`
- `src/app/api/admin/dunning/[licenseNonce]/restore/route.ts`
- `src/app/api/admin/quota/mark-billable/route.ts`
- `src/app/api/admin/quota/adjust/route.ts`
- `src/app/api/admin/quota/overage-summary/route.ts`
- `src/app/api/admin/billing/overage-events/route.ts`
- `src/app/api/admin/billing/summary/route.ts`
- `src/app/api/check-access/route.ts`
- `src/app/api/alerts/test/route.ts`
- `src/app/api/alerts/history/route.ts`
- `src/app/api/coupons/activate-redirect/route.ts`
- `src/app/api/coupons/activate/route.ts`
- `src/app/api/sophia-index/health/route.ts`
- `src/app/api/billing/usage-summary/route.ts`
- `src/app/api/cron/subscription-reminders/route.ts`
- `src/app/api/cron/uptime-check/route.ts`
- `src/app/api/debug/migrate/route.ts`
- `src/app/api/media/generate/route.ts`

**UI / hooks (6 files):**
- `src/app/[locale]/dashboard/analytics/components/usage-analytics-view.tsx`
- `src/components/admin/licenses/audit-log-table.tsx`
- `src/components/analytics/customer-search.tsx`
- `src/hooks/analytics/use-usage-metrics.ts`
- `src/hooks/analytics/use-license-metrics.ts`
- `src/hooks/analytics/use-revenue-metrics.ts`

**Libraries (20 files):**
- `src/lib/alerts/quota/alert-rule-evaluator.ts`
- `src/lib/alerts/quota/alert-schedule-manager.ts`
- `src/lib/alerts/webhook-notification-service.ts`
- `src/lib/audit/pdf-report-generator.ts`
- `src/lib/audit/logger/audit-query.ts`
- `src/lib/audit/violation-logger.ts`
- `src/lib/db/client.ts`
- `src/lib/db/auth.ts`
- `src/lib/quota/quota-enforcer.ts`
- `src/lib/email/sender.ts`
- `src/lib/billing/dunning/dunning-state-machine.ts`
- `src/lib/billing/dunning/dunning-admin-operations.ts`
- `src/lib/billing/usage-aggregator.ts`
- `src/lib/billing/email/email-delivery-service.ts`
- `src/lib/analytics/chart-export.ts`
- `src/lib/analytics/export.ts`

## Approach

Same mechanical pattern as Phase 13–19 (locked pattern):

1. Add `import { toError } from '@/lib/utils/to-error'` after existing `logger-utility` or `@/lib/*` import.
2. Replace `X as Error` → `toError(X)` for logger calls.
3. Replace `(X as Error).message` → `toError(X).message` for error-message extractors.

## Non-Goals

- `logger-utility.ts` union casts (overload typing — Phase 21+ backlog)
- `instanceof Error` ternary simplifications (~244 sites, separate effort)
- ESLint rule to enforce `toError()` (regression guard — backlog)
- Untracked WIP coupons routes `coupons/coupons/**`

## Success Criteria

- [x] Build: 0 new TS errors (621 baseline maintained)
- [x] Tests: 1306/1306 pass (baseline unchanged)
- [x] Lint: 0 new errors (pre-existing warnings only)
- [x] 46 `as Error` sites → 0 across 46 files (migrated)
- [x] No behavior regression (i18n validation passed)
- [x] Code review ≥9.5/10 APPROVE → 9.7/10 APPROVE SHIP (0 blockers, 0 criticals)
- [ ] CI GREEN + Production HTTP 200 (pending git-manager verification)

## Risk Assessment

- **Risk:** VERY LOW — pattern locked since Phase 13, mechanical migration.
- **Rollback:** revert-safe (two commits: refactor + docs).
- **Consideration:** Biggest file count yet (46). Verification grep mandatory; post-migration count must equal 3 remaining (1 `to-error.ts` comment + 2 `logger-utility.ts` union).

## Results (2026-04-23)

| Metric | Value |
|--------|-------|
| Files edited | 46 |
| Sites migrated | 46 |
| Diff | +93 / -46 |
| Tests | 1306/1306 pass (baseline) |
| TSC errors | 621 (delta 0) |
| Lint errors | 0 new |
| Code review | 9.7/10 APPROVE SHIP |
| Blockers | 0 |
| Criticals | 0 |
| Remaining `as Error` in `src/` | 3 (1 comment + 2 union-type casts) |

## Deferred (Phase 21+ backlog)

- `logger-utility.ts` 2× union-type casts (overload typing rework)
- 244 `instanceof Error` ternary simplifications
- `ClientWithStorage` → R2 migration
- ESLint rule to enforce `toError()`
- Logger-utility structured metadata pickup (`code/details/hint` on Error)
- `enriched-jwt.ts` logger-signature tech debt (lines 220/294/399)
- `raas_licenses` D1-vs-Supabase audit
- Split `lib/usage-metering/types.ts`
