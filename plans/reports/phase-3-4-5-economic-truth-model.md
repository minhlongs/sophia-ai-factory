## Phase 3-5 Implementation Report

- Files Created: 3
- Files Modified: 2
- Key Design Decisions: Pure functions for economics (no DB coupling), NULL-for-unknown pattern preserved, startTime captured before provider call
- Verification Results: Build exit 0, 8839/8839 tests PASS, zero regressions
- Notes: Status route ([id]/status/route.ts) left unchanged — MuAPI doesn't expose cost per spec

### Files Created

1. `src/seed/types/creative-job-economics.ts` (99 lines)
   - CostClassification type + const
   - ErrorCategory type + const
   - Pure functions: classifyCost, computeGrossMargin, classifyErrorForJob
   - Zero imports (seed-only, pure)

2. `src/tree/media-jobs/media-job-economics-query.ts` (116 lines)
   - MediaJobMetricsRow + ProviderReliabilityMetrics interfaces
   - calculatePercentile (linear interpolation)
   - computeProviderMetrics (success/failure rate, p50/p95 latency, retry rate, data confidence)

3. `src/tree/media-jobs/media-job-economics-aggregate.ts` (132 lines)
   - MediaJobEconomicRow + ProviderEconomicMetrics interfaces
   - aggregateEconomicMetrics (cost breakdown, revenue, gross margin, data confidence)
   - Imports from seed only

### Files Modified

1. `src/app/actions/image-generate-action.ts`
   - Added import: classifyCost from @/seed/types/creative-job-economics
   - Added startTime tracking before falProvider.generate()
   - fal-ai success insert: added provider_cost, cost_currency, cost_classification, revenue_attribution, gross_margin, requested_at, started_at
   - MuAPI pending insert: added cost_classification='UNKNOWN', requested_at

2. `src/app/api/v1/creative-studio/images/generate/route.ts`
   - Added import: classifyCost from @/seed/types/creative-job-economics
   - Added startTime tracking before falProvider.generate()
   - fal-ai success insert: added provider_cost, cost_currency, cost_classification, revenue_attribution, gross_margin, requested_at, started_at
   - MuAPI pending insert: added cost_classification='UNKNOWN', requested_at

### Key Design Decisions

- **NULL-for-unknown**: provider_cost is `null` when cost is unknown (never 0), matching migration spec
- **Gross margin deferred**: Always null at insert time — computed later when revenue is attributed
- **requested_at == started_at for fal-ai**: Sync provider has no queuing delay, so both timestamps equal the pre-generate time
- **Cost classification for fal-ai**: Currently 'UNKNOWN' because fal-image-provider returns costCents: undefined. When fal.ai exposes cost per-job, this becomes 'METERED' automatically via classifyCost()
- **MuAPI cost**: Left as 'UNKNOWN' — MuAPI doesn't expose per-job cost data

### Quality Gates

- Build: pass (exit 0)
- Type-check: pass (0 errors)
- Unit tests: pass (8839/8839, 34 skipped, 10 todo — unchanged from baseline)
- No `:any` types in new code
- No `console.log/warn/error` in new code
- Import boundaries respected: seed -> tree only
- All files under 200 lines
