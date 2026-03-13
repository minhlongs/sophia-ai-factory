---
description: 📋 Invoice Management — Create, Send, Track, Reconcile
argument-hint: [invoice-id or customer-id]
---

**Think harder** để quản lý invoices: <action>$ARGUMENTS</action>

## Invoice Lifecycle

```
Draft → Sent → Viewed → Paid (or Overdue → Dunning → Cancelled)
```

## Invoice Actions

### Create Invoice
```bash
# Generate invoice for customer
POST /api/v1/invoices
{
  "customer_id": "cust_xxx",
  "period": "2026-03",
  "auto_send": true
}

Response: { "invoice_id": "INV-2026-001234", "pdf_url": "..." }
```

### Send Invoice
```bash
# Email invoice
POST /api/v1/invoices/INV-2026-001234/send
{
  "recipient": "accounts@customer.com",
  "cc": ["finance@customer.com"],
  "message": "Thank you for your business!"
}
```

### Track Invoice Status
```bash
# Check invoice status
GET /api/v1/invoices/INV-2026-001234

Response: {
  "status": "sent",
  "sent_at": "2026-03-01T10:00:00Z",
  "viewed_at": null,
  "paid_at": null,
  "due_date": "2026-03-16"
}
```

### Reconcile Payment
```bash
# Mark invoice as paid
POST /api/v1/invoices/INV-2026-001234/reconcile
{
  "payment_id": "pay_xxx",
  "amount": 41150,
  "paid_at": "2026-03-05T14:30:00Z"
}
```

## Invoice Status Codes

| Status | Description | Action |
|--------|-------------|--------|
| `draft` | Not yet sent | Edit, finalize |
| `sent` | Emailed to customer | Track views |
| `viewed` | Customer opened | Follow up if needed |
| `paid` | Payment received | Send receipt |
| `overdue` | Past due date | Dunning sequence |
| `cancelled` | Voided | Archive |

## Invoice Templates

### Standard Invoice
```
INVOICE #INV-2026-001234
━━━━━━━━━━━━━━━━━━━━━━━━━
Date: March 4, 2026
Due: March 19, 2026

BILL TO:
Company Name
123 Business St
contact@company.com

ITEMS:
─────────────────────────
1. Platform Subscription    $99.00
   Growth Plan - March 2026

2. Usage Charges           $312.50
   1,250 MCUs × $0.25

─────────────────────────
SUBTOTAL                  $411.50
TAX (0%)                    $0.00
TOTAL                     $411.50
─────────────────────────

PAYMENT TERMS: Net 15
PAYMENT METHOD: Credit Card via Polar.sh
```

### Usage-Based Invoice
```
USAGE BREAKDOWN:
━━━━━━━━━━━━━━━━━━━━━━━━━
Included MCUs:      500
Consumed MCUs:    1,250
Overage MCUs:       750
Overage Rate:      $0.25
─────────────────────────
Overage Charge:   $187.50
```

## Bulk Operations

```bash
# Generate invoices for all active customers
POST /api/v1/invoices/bulk
{
  "period": "2026-03",
  "send_immediately": true
}

# Send payment reminders
POST /api/v1/invoices/reminders
{
  "filter": { "status": "overdue", "days_overdue": 7 }
}
```

## Integration Points

| System | Integration |
|--------|-------------|
| Polar.sh | Payment processing |
| QuickBooks | Accounting sync |
| Stripe | Backup payment processor |
| SendGrid | Email delivery |
| Slack | Payment notifications |

## Metrics

- **Days Sales Outstanding (DSO)**: Target < 30 days
- **Invoice Accuracy Rate**: Target > 99%
- **On-time Payment Rate**: Target > 95%
- **Auto-pay Adoption**: Target > 80%

## Related Commands

- `/billing` — Billing operations
- `/revenue` — Revenue tracking
- `/pricing` — Pricing setup
