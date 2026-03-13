---
description: 💵 Pricing Strategy & Configuration — Tiers, Packages, Checkout
argument-hint: [tier-name or action: create|update|analyze|optimize]
---

**Think harder** để thiết lập pricing strategy: <action>$ARGUMENTS</action>

**IMPORTANT:** Pricing phải align với value metric (MCU = $0.25/task).

## Pricing Strategy Framework

### 1. Value-Based Pricing

```
Platform Fee = Base Value + (Usage × Rate)

Base Value: Platform access, features, support
Usage: MCU (Mekong Compute Units) consumed
Rate: Decreases with tier (volume discount)
```

### 2. Tier Architecture

| Tier | Platform | MCU Rate | Break-even | Best For |
|------|----------|----------|------------|----------|
| **Free** | $0 | $0.50 | 0 MCUs | Testing, hobby |
| **Starter** | $49 | $0.35 | 140 MCUs | Side projects |
| **Growth** | $99 | $0.25 | 396 MCUs | Startups |
| **Premium** | $299 | $0.20 | 1495 MCUs | SMBs |
| **Enterprise** | Custom | $0.15 | Custom | Enterprise |

### 3. Pricing Psychology

- **Anchoring**: Premium tier anchors high value
- **Decoy**: Starter makes Growth look attractive
- **Tier naming**: Clear progression (Free→Starter→Growth→Premium→Enterprise)

## Actions

### `create` — Tạo pricing tier
```bash
# Polar.sh API
curl -X POST https://api.polar.sh/v1/products \
  -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "RaaS Growth Plan",
    "description": "For startups scaling automation",
    "price": 9900,
    "currency": "usd",
    "recurring_interval": "month",
    "metadata": {
      "mcu_rate": 0.25,
      "included_mcus": 500
    }
  }'
```

### `update` — Cập nhật pricing
```bash
# Adjust pricing based on data
curl -X PUT https://api.polar.sh/v1/products/{id} \
  -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" \
  -d '{"price": 12900}'  # $129
```

### `analyze` — Phân tích pricing effectiveness
```bash
# Conversion rates by tier
Tier        | Views | Trials | Conversions | Rate
------------|-------|--------|-------------|------
Free        | 1000  | 500    | -           | 50%
Starter     | 500   | 100    | 25          | 25%
Growth      | 300   | 150    | 60          | 40%
Premium     | 100   | 50     | 30          | 60%
```

### `optimize` — Optimize pricing
```bash
# A/B test pricing
/control: $99/mo
/variant: $129/mo (with 1000 MCUs included)

Measure: Conversion rate, MRR per visitor
```

## Pricing Pages

```
/pricing — Public pricing page
/pricing/compare — Feature comparison table
/pricing/faq — Pricing FAQ
/pricing/contact — Enterprise sales
```

## Checkout Flow

```
Click tier → Polar checkout → Payment complete →
Webhook → Activate subscription → Welcome email
```

## Metrics to Track

- **MRR Movement**: New MRR - Churned MRR
- **Expansion MRR**: Upsells, cross-sells
- **ARPU**: Average revenue per user
- **Payback Period**: CAC / monthly_revenue
- **LTV:CAC Ratio**: Target > 3:1

## Related Commands

- `/revenue` — Revenue operations
- `/raas:billing` — Billing integration
- `/marketing` — Marketing campaigns
