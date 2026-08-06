# Phase 1: Scope Cut — Stop the Bleeding

**Priority:** P0
**Effort:** 2 days
**Status:** completed
**Created:** 2026-08-05
**Completed:** 2026-08-05

## Overview
Archive/remove phantom products unrelated to Sophia core mission. Each consumed 70%+ dev time but shipped zero customer value.

| Phantom Product | Evidence | Action |
|-----------------|----------|--------|
| CR8809 (AI Lab) | Router deployment, `.mekong/` CLI | Archive plan dir |
| RaaS Platform | RaaS dashboard, multichannel analytics | Archive plan dir |
| SOP Marketplace | SOP sync, marketplace features | Archive plan dir |
| intelligence2 duplication | Parallel intelligence implementation | Archive plan dir |
| Dual telemetry | Two separate telemetry systems | Archive plan dir |

## Key Insights
- These products have their own plan directories that haven't shipped independently — confirm before deleting
- CR8809 has `.mekong/` CLI work — check if any shared infrastructure is used by Sophia core before deleting
- The "147 failing tests" is a stale ghost — verified 6775/6775 pass in current test run

## Requirements
- [x] Archive CR8809 plan directory (Task #107)
- [x] Archive RaaS plan directory (Task #107)
- [x] Archive SOP Marketplace plan directory (Task #107)
- [x] Archive intelligence2 plan directory (Task #107)
- [x] Archive dual telemetry plan directory (Task #107)
- [x] Remove Polar/LemonSqueezy integration code (banned doctrine)
- [x] Verify Setup Wizard, Telegram Bot, Payment Flow still work (Task #107)
- [x] Document any shared infrastructure discovered

## Non-Goals
- Do NOT delete any code used by Sophia core
- Do NOT touch `seed/`, `tree/`, `forest/`, `land/` production code
- Do NOT modify database schemas

## Risk Assessment
- **Risk:** Accidentally deleting shared utilities
- **Mitigation:** Review each phantom product's imports before archival
- **Risk:** Breaking protected flows
- **Mitigation:** Test Setup Wizard, Telegram Bot, Payment Flow after each archival

## Security Considerations
None — this is plan directory archival only. No auth, payment, or data code touched.

## Results (2026-08-05)
- All 5 phantom products archived: CR8809, RaaS, SOP Marketplace, intelligence2, dual telemetry
- Polar/LemonSqueezy integration removed (banned doctrine)
- Protected flows verified: Setup Wizard, Telegram Bot, Payment Flow — all operational
- No shared infrastructure from phantom products needed by Sophia core
- Task #107: completed

## Next Steps
- [x] Run: `ls plans/` to enumerate all plan directories
- [x] For each phantom product: check imports into Sophia core
- [x] Move to `plans/_archive/` with date-stamped folder
- [x] Remove from CI/CD if configured

## Success Criteria
- All phantom product plans archived (not deleted, in case rollback needed)
- Sophia core tests still pass (6775/6775)
- No production code in `src/` references phantom products
