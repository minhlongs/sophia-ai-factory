---
parent: ./plan.md
status: pending
priority: P1
effort: 20m
---

# Phase 1: Create Polar Subscription Products

## Context
- [Parent Plan](./plan.md)
- Polar Dashboard: https://polar.sh/dashboard

## Overview

Create 3 new subscription products in Polar Dashboard with 12-month commitment.

## Products to Create

| Product Name | Price | Billing | Tier |
|--------------|-------|---------|------|
| Sophia AI Factory - Starter Sub | $199/mo | Monthly recurring | BASIC |
| Sophia AI Factory - Growth Sub | $399/mo | Monthly recurring | PREMIUM |
| Sophia AI Factory - Premium Sub | $799/mo | Monthly recurring | ENTERPRISE |

## Implementation Steps

1. Login to Polar Dashboard
2. Navigate to Products
3. Create "Sophia AI Factory - Starter Sub"
   - Type: Subscription
   - Price: $199.00/month
   - Description: "Complete AI video automation. 12-month commitment."
4. Create "Sophia AI Factory - Growth Sub"
   - Type: Subscription
   - Price: $399.00/month
   - Description: "Scale your content production. 12-month commitment."
5. Create "Sophia AI Factory - Premium Sub"
   - Type: Subscription
   - Price: $799.00/month
   - Description: "Enterprise power and support. 12-month commitment."
6. Copy all 3 product IDs

## Output

Product IDs to add to Vercel:
- `POLAR_PRODUCT_ID_STARTER_SUB=<uuid>`
- `POLAR_PRODUCT_ID_GROWTH_SUB=<uuid>`
- `POLAR_PRODUCT_ID_PREMIUM_SUB=<uuid>`

## Todo

- [ ] Create Starter Sub product in Polar
- [ ] Create Growth Sub product in Polar
- [ ] Create Premium Sub product in Polar
- [ ] Copy product IDs
- [ ] Add env vars to Vercel

## Success Criteria

- 3 subscription products visible in Polar Dashboard
- Product IDs saved for Phase 2
