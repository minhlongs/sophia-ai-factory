---
phase: 3
title: "Unify pricing — single NOWPayments tier config"
priority: P1
status: pending
---

# Phase 3: Unify Pricing

## Context Links
- Current ai-factory pricing: `src/components/pricing/pricing-data.ts` (NOWPayments, 4 tiers)
- Proposal pricing: `apps/sophia-proposal/lib/pricing-config.ts` (Polar.sh MCU-based)
- NOWPayments webhook: `src/app/api/webhooks/nowpayments/route.ts`
- Pricing section: `src/components/pricing/pricing-section.tsx`
- Pricing card: `src/components/pricing/pricing-card.tsx`

## Overview

Create single unified pricing config covering both Video Factory and RaaS features. Keep NOWPayments as payment provider. Add RaaS features (MCU credits, AI commands) to existing tiers.

## Key Insights

Current ai-factory tiers (NOWPayments USDT):
| Tier | Price | Video Features |
|------|-------|----------------|
| Starter (BASIC) | $199/mo | 5 templates, basic analytics |
| Growth (PREMIUM) | $399/mo | unlimited templates, advanced analytics |
| Premium (ENTERPRISE) | $799/mo | white label, API, SLA |
| Master (MASTER) | $4,999 one-time | everything + lifetime |

Proposal MCU tiers (Polar.sh):
| Tier | MCU/month | AI Commands |
|------|-----------|-------------|
| Starter | 1,000 | 5 commands |
| Growth | 5,000 | 15 commands |
| Premium | 20,000 | 15 + custom |
| Master | 100,000 | all + custom |

**Unified plan**: keep NOWPayments pricing, add MCU + commands to each tier.

## Related Code Files

### Files to Modify
- `src/components/pricing/pricing-data.ts` -- add RaaS features to each tier's feature list
- `src/components/pricing/pricing-card.tsx` -- may need "Video" and "RaaS" feature grouping
- `messages/en.json` -- add `pricing.features.mcu_*`, `pricing.features.commands_*`
- `messages/vi.json` -- same

### Files to Create
- `src/lib/unified-tier-config.ts` -- single source of truth for tier definitions (Video + RaaS limits)

### Files NOT to touch
- `src/app/api/webhooks/nowpayments/route.ts` -- payment flow unchanged
- `src/lib/clients/nowpayments-client.ts` -- client unchanged
- `src/components/pricing/pricing-section.tsx` -- layout unchanged

## Architecture

```
unified-tier-config.ts (SINGLE SOURCE OF TRUTH)
├── Video limits: templates, campaigns, video minutes
├── RaaS limits: MCU credits, AI commands, team members
├── Pricing: amount in cents, currency (USDT)
└── Tier enum: BASIC | PREMIUM | ENTERPRISE | MASTER

pricing-data.ts (DISPLAY ONLY)
├── imports from unified-tier-config.ts
├── uses useTranslations() for i18n feature labels
└── renders combined feature list

raas-gate.ts (ENFORCEMENT)
├── imports from unified-tier-config.ts
├── checks MCU balance against tier allowance
└── checks command access against tier permissions
```

## Implementation Steps

1. Create `src/lib/unified-tier-config.ts`:
   ```typescript
   export const UNIFIED_TIERS = {
     BASIC: {
       price: 19900,        // $199/mo in cents
       currency: 'USDT',
       // Video limits
       templates: 5,
       campaignsPerMonth: 10,
       // RaaS limits
       mcuMonthly: 1000,
       aiCommands: 5,
       teamMembers: 1,
       apiAccess: true,
       webhooks: false,
     },
     PREMIUM: { ... },
     ENTERPRISE: { ... },
     MASTER: { ... },
   } as const;
   ```

2. Update `pricing-data.ts` to import from `unified-tier-config.ts`:
   - Remove hardcoded feature lists
   - Generate features from config + i18n translations
   - Group features under "Video" and "AI Automation" subheadings

3. Update `pricing-card.tsx` if needed:
   - Add feature group headers (optional, depends on design)
   - Keep simple if feature list is short enough

4. Update `raas-gate.ts` to import tier limits from `unified-tier-config.ts` instead of any Polar references

5. Add i18n keys for new RaaS features in pricing section

## Todo List

- [x] Create `unified-tier-config.ts` with combined limits
- [x] Update `pricing-data.ts` to use unified config
- [x] Update `raas-gate.ts` to use unified config for MCU limits (via aggregator.ts QUOTA_LIMITS)
- [x] Add en/vi translation keys for RaaS pricing features
- [ ] Verify pricing page renders correctly (visual check pending)
- [x] Verify `npm run build` passes

## Success Criteria

- Single `unified-tier-config.ts` is the source of truth for ALL tier limits
- Pricing page shows Video + RaaS features per tier
- `raas-gate.ts` enforces MCU limits from unified config
- No Polar.sh references remain in ai-factory pricing code
- NOWPayments flow unchanged
- i18n works en/vi
