---
description: 📄 Billing Operations — Invoices, Payments, Subscriptions, Usage
argument-hint: [customer-id or action: list|generate|send|reconcile]
---

**Think harder** để quản lý billing operations: <action>$ARGUMENTS</action>

**IMPORTANT:** All billing via Polar.sh Standard Webhooks.

## Billing Architecture

```
MCU Consumption → Usage Tracker → Polar API → Invoice →
Customer Payment → Webhook → Accounting Sync
```

## Actions

### `list` — Danh sách billing records
```bash
# List all invoices
curl -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" \
  https://api.polar.sh/v1/invoices?limit=50

# List subscriptions
curl -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" \
  https://api.polar.sh/v1/subscriptions?status=active
```

### `generate` — Tạo invoice
```bash
# Generate monthly usage invoice
POST /v1/invoices
{
  "customer_id": "cust_xxx",
  "period_start": "2026-03-01",
  "period_end": "2026-03-31",
  "line_items": [
    {
      "description": "Platform Fee - Growth Plan",
      "amount": 9900
    },
    {
      "description": "MCU Usage (1,250 × $0.25)",
      "amount": 31250
    }
  ],
  "total": 41150  # $411.50
}
```

### `send` — Gửi invoice
```bash
# Email invoice to customer
POST /v1/invoices/{id}/send
{
  "email": "customer@company.com",
  "message": "Your March 2026 invoice is ready."
}
```

### `reconcile` — Đối soát payments
```bash
# Match payments to invoices
1. Fetch Polar payments: GET /v1/payments
2. Fetch local invoices: SELECT * FROM invoices
3. Match by reference_id
4. Flag discrepancies: unpaid, underpaid, overpaid
```

## Invoice Template

```
╔══════════════════════════════════════════════╗
║  AGENCYOS — TAX INVOICE                     ║
╠══════════════════════════════════════════════╣
║  Invoice #: INV-2026-001234                  ║
║  Date: 2026-03-04                            ║
║  Due: 2026-03-19 (Net 15)                    ║
╠══════════════════════════════════════════════╣
║  Bill To:                                    ║
║  Company Name                                ║
║  customer@company.com                        ║
╠══════════════════════════════════════════════╣
║  Description              Amount             ║
║  ───────────────────────────────────────     ║
║  Platform Fee (Growth)    $99.00             ║
║  MCU Usage (1,250)        $312.50            ║
║  ───────────────────────────────────────     ║
║  TOTAL:                   $411.50            ║
╚══════════════════════════════════════════════╝
```

## Billing Events (Webhooks)

| Event | Trigger | Action |
|-------|---------|--------|
| `subscription.created` | New subscription | Activate plan, send welcome |
| `subscription.updated` | Tier change | Prorate, update access |
| `subscription.cancelled` | Cancellation | Grace period, export data |
| `invoice.paid` | Payment received | Mark paid, send receipt |
| `invoice.payment_failed` | Failed payment | Retry, notify customer |
| `refund.created` | Refund issued | Reverse payment, update access |

## Dunning Management

```
Day 0: Payment failed → Email notification
Day 3: Retry payment → Email + in-app
Day 7: Second retry → Email + suspend MCU usage
Day 14: Final notice → Downgrade to Free
Day 30: Cancel subscription
```

## Usage Metering

```bash
# MCU usage tracking
{
  "customer_id": "cust_xxx",
  "period": "2026-03",
  "opening_balance": 500,
  "consumed": 1250,
  "closing_balance": 0,
  "overage": 750,
  "overage_rate": 0.25,
  "overage_charge": 187.50
}
```

## Accounting Sync

```
Polar.sh → Webhook → Billing Service →
QuickBooks/Xero → GL Entry → Financial Reports
```

## Related Commands

- `/revenue` — Revenue tracking
- `/pricing` — Pricing configuration
- `/raas:billing` — Billing integration
