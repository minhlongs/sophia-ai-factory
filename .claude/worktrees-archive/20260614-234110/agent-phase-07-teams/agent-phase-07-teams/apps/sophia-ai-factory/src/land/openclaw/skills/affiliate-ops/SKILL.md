---
name: affiliate-ops
description: Payout calculation, tier management, fraud detection, offer sync for affiliate engine.
triggers: payout, commission, affiliate, tier, offer, conversion, click
tier: lite
---

# Affiliate Ops Skill

## When to activate
When processing affiliate conversions, calculating payouts, syncing offers, or detecting fraud.
Activate when task prompt contains: "payout", "commission", "affiliate", "offer sync", "conversion".

## Commission Tiers

| Tier | Commission Rate | Minimum Payout |
|---|---|---|
| Tier 1 | 10% | $20 |
| Tier 2 | 15% | $50 |
| Tier 3 | 20% | $100 |

## Key Operations

### Offer Sync (hourly cron)
1. Fetch offers from affiliate network API
2. Upsert into affiliate_offers table (tenant-scoped)
3. Mark trending offers (CTR > threshold)
4. Emit affiliate.offers.synced event

### Payout Calculation
1. Aggregate approved conversion_events per affiliate per period
2. Apply commission rate based on affiliate tier
3. Deduct platform fee (5%)
4. Generate payout record in USDT equivalent

### Fraud Detection
- Flag click events with same IP hash > 5 in 1 hour
- Flag conversions without matching click_id
- Auto-reject flagged conversions (status = 'rejected')

## Key Constraints
- All financial calculations in USD cents (avoid floating point)
- tenant_id always scoped — never cross-tenant payout calculation
- Payout requires approved status — pending/rejected not paid
- Minimum payout threshold enforced before any transfer
