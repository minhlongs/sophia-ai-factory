# Phase 6: ARR Gap Fill (~$1M Revenue Path)
> Status: pending | Priority: P2 | Runs after Phases 1-5 deployed

## Context
6-8 capability gaps identified for reaching $1M ARR. DB tables exist for some (referral rewards migrations 0178-0179), but no business logic/UI wired up. Source: `docs/sop-ceo-media-company-1m-arr.md`.

## Requirements (6 Pillars)
1. **Referral Rewards** (8-10h) — redeem DB rows → fulfillment service → customer UI
2. **Usage-Pressure Conversion UX** (4-6h) — credit display + upsell triggers in dashboard
3. **Reseller/Agency Program** (12-16h) — wholesale tiers, agency dashboard, commissions
4. **Brand Sponsorship Pipeline** (8-12h) — deal tracking, contracts, revenue attribution
5. **Customer Lifecycle Metrics** (6-8h) — MRR, churn, LTV, CAC dashboard
6. **ARR Gate Tracking Dashboard** (4-6h) — G0→G4 milestones ($100→$1M ARR)

## Architecture
- Each pillar is independently deployable — separate phase files recommended
- Leverages existing billing/quota/affiliates domains in `land/` layer
- New UI in `src/components/stitch/screens/arr-*` (consistent with Ambersaigon Skyline)
- Inngest jobs for async fulfillment (referral rewards, brand deals)

## Files to Create (per pillar)
| Pillar | New Files |
|--------|-----------|
| Referral Rewards | `tree/referral/`, `land/referral/`, UI screens |
| Usage-Pressure | Land billing quota-display component upsell banner |
| Reseller/Agency | `tree/reseller/`, `land/reseller/`, agency dashboard |
| Brand Sponsorship | `tree/sponsorship/`, `land/sponsorship/`, deal pipeline UI |
| Lifecycle Metrics | `forest/metrics/`, analytics dashboard |
| ARR Gates | `land/arr/`, gate-tracking dashboard |

## Implementation Approach
Split into 6 sub-phases, ship pillars 1+2 together (fastest ARR impact), then 3+4, then 5+6:
- **Sub-phase 6A:** Referral rewards + Usage-pressure conversion (12-16h)
- **Sub-phase 6B:** Reseller program + Brand sponsorship (20-28h)
- **Sub-phase 6C:** Lifecycle metrics + ARR gate dashboard (10-14h)

## Out of Scope
- Pillar trimming without stakeholder approval
- Revenue projections/forecasting models (data only)
- Any changes to core billing/payment flows beyond display
