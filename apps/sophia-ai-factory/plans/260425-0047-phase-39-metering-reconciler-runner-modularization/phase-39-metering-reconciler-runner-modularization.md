# Phase 39 — `worker/lib/metering-reconciler-runner.ts` Modularization

**Status:** 🔄 IN PROGRESS (2026-04-25)
**Priority:** P3 (file-size threshold, 497L > 200L)
**Plan Parent:** `plans/260419-2121-triet-tieu-no-ky-thuat/plan.md`

## Scope

Split 497-line `src/worker/lib/metering-reconciler-runner.ts` into 5 focused sub-modules.

## Sub-modules

| File | Contents | ~Lines |
|------|----------|--------|
| `metering-reconciler-types.ts` | AggregatedUsage, LicenseValidationResult, CRON_RECONCILIATION_CONFIG | ~35 |
| `metering-reconciler-error-logger.ts` | logErrorToSentry, logErrorToKv | ~50 |
| `metering-reconciler-license-validator.ts` | validateLicense, validateAllLicenses | ~90 |
| `metering-reconciler-aggregator.ts` | aggregateByLicenseAndFeature, getMeteringLogsFromKv, markReconciledLogs | ~75 |
| `metering-reconciler-runner.ts` | runMeteringReconciliation + barrel re-export | ~195 |

## Consumers (unchanged imports)

- `worker/index.ts`: `runMeteringReconciliation` from `./lib/metering-reconciler-runner`

## Notes

- Zero logic changes — pure reorganization
- `validateAllLicenses` extracted from inline loop in step 4 of `runMeteringReconciliation`
- `markReconciledLogs` extracted from inline loop in step 6
- Sub-modules import siblings directly (NOT via barrel) to avoid circular dependency
- `metering-reconciler-runner.ts` imports from all 4 siblings, then barrel re-exports

## Success Criteria

- [ ] Build: 0 TS errors (611 baseline maintained)
- [ ] Tests: 1321/1321 pass
- [ ] No logic changes — pure reorganization
- [ ] All existing imports unchanged
- [ ] Code review: 9.5/10 AUTO-APPROVE
- [ ] CI/CD: GREEN
- [ ] Production: HTTP 200
