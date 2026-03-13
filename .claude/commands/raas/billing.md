---
description: 💰 RaaS billing integration — Polar.sh + MCU metering
argument-hint: [action: setup|status|sync|test]
---

**Think harder** để quản lý RaaS billing: <action>$ARGUMENTS</action>

**IMPORTANT:** Payment provider = Polar.sh ONLY (NO PayPal).

## Context

- MCU = Mekong Compute Unit = 1 verified task completion = $0.25
- Platform fee: $99/mo (billed via Polar.sh subscription)
- Billing integration: Phase 6 trong algo-trader bootstrap plan
- SDK: `@polar-sh/sdk`

## Actions

### `setup` — Thiết lập billing integration
1. Verify Polar.sh SDK installed: `@polar-sh/sdk` trong `apps/algo-trader/package.json`
2. Tạo billing service module:
   - `apps/algo-trader/src/billing/polar-billing-service.ts` — Polar API wrapper
   - `apps/algo-trader/src/billing/mcu-metering-tracker.ts` — MCU usage tracking
   - `apps/algo-trader/src/billing/billing-webhook-handler.ts` — Polar webhook processing
3. Environment vars cần thiết:
   ```
   POLAR_ACCESS_TOKEN=
   POLAR_ORGANIZATION_ID=
   POLAR_WEBHOOK_SECRET=
   ```
4. Register webhook route trong Fastify server

### `status` — Kiểm tra billing status
```bash
# Check Polar connection
curl -s -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" \
  https://api.polar.sh/v1/organizations 2>/dev/null | jq '.items[0].name'

# Check MCU usage (from local tracking)
cat apps/algo-trader/data/mcu-usage.json 2>/dev/null | jq '{
  total_mcus: .total,
  this_month: .current_month,
  revenue: (.current_month * 0.25)
}'
```

### `sync` — Đồng bộ billing data
1. Fetch subscription status từ Polar.sh API
2. Reconcile MCU usage với completed missions
3. Generate billing report

### `test` — Test billing flow
1. Create test subscription checkout link
2. Simulate MCU consumption event
3. Verify webhook delivery
4. Check metering accuracy

## MCU Metering Architecture

```
Mission Complete (Tôm Hùm)
  → mission_done signal
  → MCU Tracker increments counter
  → If threshold reached → Polar.sh usage record
  → Monthly invoice auto-generated
```

## Polar.sh Integration Points

| Endpoint | Purpose |
|----------|---------|
| `POST /api/webhooks/polar` | Receive subscription/payment events |
| `GET /api/v1/billing/usage` | Current MCU usage for tenant |
| `GET /api/v1/billing/invoices` | Invoice history |
| `POST /api/v1/billing/checkout` | Generate Polar checkout URL |

## Pricing Tiers

| Tier | Platform Fee | MCU Rate | Included MCUs |
|------|-------------|----------|---------------|
| Starter | $0/mo | $0.50/MCU | 10 free |
| Growth | $99/mo | $0.25/MCU | 500 included |
| Enterprise | Custom | $0.15/MCU | Unlimited |
