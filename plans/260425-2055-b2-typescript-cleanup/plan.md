# B2: TypeScript Error Cleanup Initiative

## Overview

Resolve 462 TypeScript errors currently masked by `ignoreBuildErrors: true` in `next.config.ts:24`. Errors distributed across 5 main classes:

| Type     | Count | Density |
|----------|-------|---------|
| TS18046  | 95    | HIGH    |
| TS2339   | 80    | HIGH    |
| TS2345   | 73    | HIGH    |
| TS2322   | 63    | HIGH    |
| TS2352   | 43    | MEDIUM  |
| Other    | 108   | LOW     |

## Strategy

- **1 file per PR** for iterative validation
- **Prioritize TS18046** (object undefined/null checks) via Zod + type guards
- **Introduce Zod schemas** for API inputs (rule: "Zod validation on all API inputs")
- **Success criteria**: 0 TS errors, ignoreBuildErrors removed, tests 100% pass

## Phases

### Phase 1: API Handler Zod Validation (DONE)
- File: `src/app/api/admin/api-keys/route.ts`
- Change: Manual `unknown` checks → Zod schema validation
- Errors fixed: -10 TS18046
- Metric: 462 → **452 errors**
- Tests: 1394 pass, 0 fail

### Phase 2: Pricing Section Type Guards (DONE)
- File: `src/components/pricing/pricing-section.tsx`
- Change: Added 2 local response interfaces (CouponActivateResponse, CheckoutResponse) + typed casts on fetch().json()
- Errors fixed: -6 TS18046
- Metric: 452 → **446 errors**
- Tests: 1394 pass, 0 fail

### Phase 3: Setup Wizard Type Guards (DONE)
- File: `src/app/setup-wizard/page.tsx`
- Change: Added type cast pattern for response validation (matches Phase 2)
- Errors fixed: -6 TS18046
- Metric: 446 → **440 errors**
- Tests: 1394 pass, 0 fail
- Review: 9.7/10 auto-approved

### Phase 4: License Regenerate Hook (NEXT)
Prioritized by TS18046 density:

1. `src/components/admin/licenses/use-license-regenerate.ts` (5 TS18046) — **NEXT**
2. `src/components/admin/licenses/use-license-list-actions.ts` (5 TS18046)
3. `src/worker/lib/metering-reconciler-license-validator.ts` (4 TS18046)
4. `src/middleware/rate-limit-wrapper.test.ts` (4 TS18046)
5. `src/lib/heygen/heygen-client.ts` (4 TS18046)
6. `src/components/raas/api-key-create-modal.tsx` (4 TS18046)
7. `src/app/api/webhooks/telegram/route.ts` (4 TS18046)
8. `src/app/[locale]/dashboard/proposals/page.tsx` (4 TS18046)

## Success Verification

```bash
# After completing each phase
npx tsc --noEmit  # MUST show 0 errors
npm test          # MUST pass 100%
git diff next.config.ts  # ignoreBuildErrors removed
```

## Progress Summary

| Phase | File | Δ | Total | Cumulative % |
|-------|------|---|-------|--------------|
| 1 | api-keys/route.ts | -10 | 462→452 | -2.2% |
| 2 | pricing-section.tsx | -6 | 452→446 | -4.1% |
| 3 | setup-wizard/page.tsx | -6 | 446→440 | -4.8% |

## Status

- [x] Phase 1: API Handler Zod Validation
- [x] Phase 2: Pricing Section Type Guards
- [x] Phase 3: Setup Wizard Type Guards
- [ ] Phase 4-10: Backlog resolution
- [ ] Final: Remove ignoreBuildErrors, verify 0 errors
