# Per-Tenant Overrides Report — 260504

## Part A: Scoring

**Files modified:**
- `src/lib/tenant-settings/defaults.ts` — aligned `ScoringSettings` weights to match scoring.ts (`cookieDuration/payoutSpeed/programAge/approvalRate`); updated `DEFAULT_SCORING` values (+8 LOC)
- `src/lib/affiliates/scout/writer.ts` — imports `getOrDefault` + `DEFAULT_SCORING`; `runAffiliateScout` fetches tenant scoring settings before scoring loop, merges with caller-supplied ctx (~15 LOC added)
- `src/lib/tenant-settings/namespace-validators.ts` — already correct (no change needed)
- `src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx` — replaced Scoring placeholder with `ScoringPanel`: 5 sliders + threshold + save/reset via PUT/DELETE `/api/v1/settings/scoring` (~80 LOC)

## Part B: Geo

**Files modified:**
- `src/lib/tenant-settings/defaults.ts` — added `removedRules` to `GeoSettings` interface and `DEFAULT_GEO` (+5 LOC)
- `src/seed/security/geo-gate.ts` — added imports for registry/defaults; added `resolveTenantRules()` (merges defaults + additionalRules, filters removedRules) and `isCategoryAllowedForTenant()` async variants (+75 LOC)
- `src/lib/affiliates/scout/writer.ts` — switched geo check to `isCategoryAllowedForTenant(db, tenantId, ...)` instead of static `isCategoryAllowed` (+2 LOC change)
- `src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx` — replaced Geo placeholder with `GeoPanel`: defaults read-only table, per-country Remove toggle + WARNING modal, Add rule form (~120 LOC)

## Part C: Cron

**Files modified:**
- `src/lib/tenant-settings/defaults.ts` — added `enabled` field to `CronSettings` and `DEFAULT_CRON` (+8 LOC)
- `src/app/api/cron/affiliate-scout/route.ts` — removed global idempotency check; per-tenant `cron.enabled.affiliateScout` + `affiliateScoutCadenceHours` enforcement via `isTenantRunRecent()`; records per-tenant run key `affiliate-scout-tenant-{id}` (~50 LOC added); doc comment explains wrangler.toml fixed at `0 */4 * * *`
- `src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx` — replaced Cron placeholder with `CronPanel`: cadence dropdown (1/2/4/6/12/24/48/168h), enable/disable toggles, cron expression text input for content producer (~80 LOC)

## Tests Added

| File | Tests | Status |
|---|---|---|
| `src/lib/affiliates/scout/__tests__/writer.test.ts` | +4 (scoring/geo override suites) | PASS |
| `src/lib/tenant-settings/__tests__/per-tenant-overrides-integration.test.ts` | 16 new (scoring/geo/cron each namespace) | PASS |
| `src/seed/security/__tests__/geo-gate.test.ts` | +8 (resolveTenantRules + isCategoryAllowedForTenant) | PASS |

**Total new tests: 28**

## TypeScript

`npx tsc --noEmit` — 0 errors.

## Full Suite

279 test files, 2776 tests pass, 0 failures.

## Skipped / Notes

- API routes PUT/DELETE `/api/v1/settings/{scoring,geo,cron}` assumed to exist from Phase 12 settings framework (not in file ownership). UI panels call them correctly.
- `DEFAULT_SCORING` weights in `defaults.ts` were misaligned with `scoring.ts` before this phase; corrected as part of Part A.
