# Phase 5: Tier Logic Unification

## Overview
- Priority: P1
- Status: Complete
- Group: 1 (parallel with Phase 1)
- Effort: 4h (completed)

Merge 3 tier implementations into 1. Single config + single access checker.

## Current State (3 modules)
- `lib/tier-guard.ts` — checkLimit(), checkMultiChannelAccess() — **KEEP**
- `lib/tier-gate.ts` — verifyTierAccess() — **DELETE** (0 imports found, has test file)
- `lib/unified-tier-config.ts` — MCU pricing, tier features — **MERGE into config/tiers.ts**
- `config/tiers.ts` — getTierConfig() — **KEEP as single source**

## Files to Delete
- `src/lib/tier-gate.ts`
- `src/lib/tier-gate.test.ts`

## Files to Update

### Merge unified-tier-config → config/tiers.ts
Files importing unified-tier-config (9 files):
1. `src/app/components/sections/production-cost-calculator.tsx`
2. `src/app/api/raas/usage/route.ts`
3. `src/app/api/raas/templates/route.ts`
4. `src/config/tiers.ts` (self-import — merge content)
5. `src/components/raas/mission-launcher.tsx`
6. `src/components/raas/mcu-balance-widget.tsx`
7. `src/components/pricing/pricing-data.ts`
8. `src/lib/usage-metering/aggregator.ts`
9. `src/lib/billing/video-production-cost-engine.ts`

### Rename tier-guard (optional, lower priority)
- `lib/tier-guard.ts` → `lib/tier/tier-access-checker.ts`
- Update 5+ imports

## Implementation Steps

1. Read `unified-tier-config.ts` and `config/tiers.ts` — identify overlapping exports
2. Merge unique exports from unified-tier-config into config/tiers.ts
3. Update 9 files to import from `@/config/tiers` instead of `@/lib/unified-tier-config`
4. Delete `tier-gate.ts` + `tier-gate.test.ts`
5. Delete `unified-tier-config.ts`
6. Run build + tests

## Success Criteria
- [x] 0 imports from `@/lib/tier-gate`
- [x] 0 imports from `@/lib/unified-tier-config`
- [x] Single tier config at `config/tiers.ts`
- [x] Single access checker at `lib/tier-guard.ts`
- [x] Build + tests pass

---

## Completion Summary

**Completed:** 2026-04-14

- tier-gate.ts + test deleted (had 0 imports)
- unified-tier-config.ts merged into config/tiers.ts
- 9 files updated to import from config/tiers instead of unified-tier-config
- tier-guard.ts retained as single access checker
- Single source of truth for tier configuration
- 844/844 tests passing
- Build clean
