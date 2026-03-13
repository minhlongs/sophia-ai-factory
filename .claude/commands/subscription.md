---
description: 🔄 Subscription Management — Activate, Upgrade, Downgrade, Cancel
argument-hint: [subscription-id or action: list|activate|upgrade|downgrade|cancel]
---

**Think harder** để quản lý subscriptions: <action>$ARGUMENTS</action>

## Subscription States

```
trial → active → paused → cancelled → expired
              ↓
         upgraded/downgraded
```

## Actions

### `list` — Danh sách subscriptions
```bash
# List all active subscriptions
GET /api/v1/subscriptions?status=active

# List by tier
GET /api/v1/subscriptions?tier=Growth

# List expiring soon
GET /api/v1/subscriptions?expires_in=7  # Next 7 days
```

### `activate` — Kích hoạt subscription
```bash
# Activate after payment
POST /api/v1/subscriptions/activate
{
  "customer_id": "cust_xxx",
  "tier": "Growth",
  "trial_end": "2026-03-18",
  "billing_cycle": "monthly"
}
```

### `upgrade` — Nâng tier
```bash
# Upgrade from Starter to Growth
POST /api/v1/subscriptions/sub_xxx/upgrade
{
  "new_tier": "Growth",
  "effective": "immediate",  # or "next_billing_cycle"
  "prorate": true
}

# Proration calculation
Current: Starter ($49) → 15 days used
New: Growth ($99) → 15 days remaining
Proration: ($99 - $49) × (15/30) = $25
```

### `downgrade` — Hạ tier
```bash
# Downgrade from Premium to Growth
POST /api/v1/subscriptions/sub_xxx/downgrade
{
  "new_tier": "Growth",
  "effective": "next_billing_cycle",
  "prorate": false  # No refund, credit applied
}
```

### `cancel` — Hủy subscription
```bash
# Cancel with end-of-period access
POST /api/v1/subscriptions/sub_xxx/cancel
{
  "effective": "period_end",  # or "immediate"
  "reason": "too_expensive",
  "feedback": "Switching to competitor"
}
```

## Subscription Tiers

| Tier | Price | MCU Rate | Included MCUs | Features |
|------|-------|----------|---------------|----------|
| **Free** | $0 | $0.50 | 10 | Basic features |
| **Starter** | $49 | $0.35 | 100 | Email support |
| **Growth** | $99 | $0.25 | 500 | Priority support, API access |
| **Premium** | $299 | $0.20 | 2000 | Dedicated support, SLA |
| **Enterprise** | Custom | $0.15 | Unlimited | Custom features |

## Lifecycle Events

| Event | Trigger | Webhook |
|-------|---------|---------|
| `subscription.created` | New subscription | `subscription.created` |
| `subscription.activated` | Payment confirmed | `subscription.activated` |
| `subscription.upgraded` | Tier upgrade | `subscription.updated` |
| `subscription.downgraded` | Tier downgrade | `subscription.updated` |
| `subscription.cancelled` | Cancellation | `subscription.cancelled` |
| `subscription.renewed` | Auto-renewal | `subscription.renewed` |
| `subscription.expired` | Payment failed | `subscription.expired` |

## Dunning Flow (Failed Payment)

```
Day 0: Payment failed
  → Email: "Payment issue"
  → Retry in 3 days

Day 3: First retry
  → Email: "Retry attempt"
  → In-app notification

Day 7: Second retry
  → Email: "Final notice"
  → Suspend MCU usage

Day 14: Cancel
  → Downgrade to Free
  → Export data option
```

## Retention Strategies

| Risk Level | Signal | Intervention |
|------------|--------|--------------|
| Low | Regular usage | Monthly check-in email |
| Medium | Usage drop 50% | Personal outreach, offer help |
| High | No usage 14 days | Discount offer, success call |
| Critical | Cancellation requested | Save offer, exit survey |

## Metrics

- **MRR from Subscriptions**: Σ(active subs × tier_price)
- **Churn Rate**: (cancelled subs / total subs) × 100
- **Expansion Rate**: (upgrades - downgrades) / total subs
- **Net Revenue Retention**: (ending MRR - churned MRR) / starting MRR

## Related Commands

- `/pricing` — Pricing configuration
- `/billing` — Billing operations
- `/revenue` — Revenue tracking
