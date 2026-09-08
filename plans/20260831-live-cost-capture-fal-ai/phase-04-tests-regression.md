# Phase 4 — Tests + Regression

## Overview
- Priority: HIGH
- Status: PENDING
- Description: Add tests for the new economic fields and verify full
  regression passes.

## Key Insights
- Existing test file `fal-image-provider.test.ts` has comprehensive
  coverage of success/error/circuit-breaker paths — extend it.
- The new fields are all OPTIONAL, so existing tests should pass
  without modification (verify this first — it's the regression gate).

## Requirements
- **TR-1**: Success path returns `costCents = 1` for flux-schnell.
- **TR-2**: Success path returns `costClassification = 'METERED'` for
  known model.
- **TR-3**: Success path returns `costClassification = 'UNKNOWN'` for
  unknown/unpriced model.
- **TR-4**: `retryCount` = 1 on first-try success, = 3 on
  retry-exhausted failure.
- **TR-5**: `requestedAt` and `startedAt` are present and
  `requestedAt <= startedAt`.
- **TR-6**: Failure path: caught error carries `retryCount` and `code`
  (FailureKind).
- **TR-7**: `getFalModelPriceCents` returns correct values for known
  models, `undefined` for unknown.
- **TR-8**: `FAL_PRICING_JSON` env override works (set env in test,
  verify override value returned).
- **TR-9**: Malformed `FAL_PRICING_JSON` falls back to static table.
- **TR-10**: Full regression — `npm test` all pass.

## Related Code Files
- **Modify**: `src/seed/ai/providers/__tests__/fal-image-provider.test.ts`
- **Create**: `src/seed/config/__tests__/fal-pricing.test.ts`
- **Read**: existing test patterns for mock style

## Implementation Steps
1. **Regression gate first**: Run `npm test` on the current dirty tree
   to confirm baseline passes. If concurrent-session work broke tests,
   note it but do NOT fix (out of scope — unless it's in files I touch).
2. Add to `fal-image-provider.test.ts`:
   - `describe('economic enrichment')` block:
     - success returns costCents=1, costClassification='METERED'
     - unknown model returns costClassification='METERED'? NO —
       costClassification='UNKNOWN', costCents=undefined
     - retryCount=1 on clean success
     - retryCount=3 on retry-exhausted failure
     - requestedAt/startedAt present and ordered
     - failure error carries retryCount
3. Create `fal-pricing.test.ts`:
   - known model → correct cents
   - unknown model → undefined
   - env override → returns override value
   - malformed env → fallback + no throw
4. Run full `npm test` — all pass.
5. Run `npm run build` — 0 errors.

## Todo
- [ ] Regression gate: baseline `npm test` on dirty tree
- [ ] Add economic enrichment tests to provider test file
- [ ] Create `fal-pricing.test.ts`
- [ ] Full `npm test` all pass
- [ ] `npm run build` 0 errors

## Success Criteria
- All new tests pass.
- All existing tests still pass (no regression).
- `npm run build` 0 TypeScript errors.
- No `:any` types added.

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Dirty tree baseline broken by concurrent work | Run baseline first; if broken in files I don't touch, document as pre-existing and proceed. |
| Env-var test pollution | Use `vi.stubEnv` + restore in afterEach. |
