---
description: 💰 Revenue Operations — Pricing, Billing, Invoicing, Revenue Tracking
argument-hint: [action: pricing|billing|invoice|revenue|forecast|analyze]
---

**Think harder** để thực hiện revenue ops: <action>$ARGUMENTS</action>

**IMPORTANT:** Tất cả payment integration sử dụng Polar.sh (NO PayPal).

## Revenue Operations Matrix

| Action | Purpose | Output |
|--------|---------|--------|
| `pricing` | Thiết lập pricing tiers | Pricing table, checkout links |
| `billing` | Quản lý billing cycles | Invoices, payment status |
| `invoice` | Tạo/gửi invoices | PDF invoice, email delivery |
| `revenue` | Tracking revenue metrics | MRR, ARR, Churn rate |
| `forecast` | Revenue forecasting | 30/60/90 day projections |
| `analyze` | Revenue analysis | Cohort analysis, LTV, CAC |

## Revenue Metrics Dashboard

```bash
# MRR (Monthly Recurring Revenue)
MRR = Σ(active_subscriptions × tier_price)

# ARR (Annual Recurring Revenue)
ARR = MRR × 12

# Churn Rate
Churn = (lost_customers / total_customers) × 100

# LTV (Lifetime Value)
LTV = (avg_revenue_per_user × gross_margin) / churn_rate

# CAC (Customer Acquisition Cost)
CAC = total_sales_marketing / new_customers_acquired
```

## Pricing Tiers (RaaS Platform)

| Tier | Price | MCU Rate | Included | Target |
|------|-------|----------|----------|--------|
| Starter | $0/mo | $0.50/MCU | 10 free | Hobbyists |
| Growth | $99/mo | $0.25/MCU | 500 included | Startups |
| Premium | $299/mo | $0.20/MCU | 2000 included | SMBs |
| Enterprise | Custom | $0.15/MCU | Unlimited | Enterprise |

## Workflow

### 1. Pricing Setup
```bash
# Create pricing tiers in Polar.sh
POST /v1/products
{
  "name": "RaaS Growth Plan",
  "price": 9900,
  "currency": "usd",
  "interval": "month"
}
```

### 2. Revenue Tracking
```bash
# Fetch revenue metrics
curl -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" \
  https://api.polar.sh/v1/metrics/revenue
```

### 3. Invoice Generation
```bash
# Generate monthly invoice
POST /v1/invoices
{
  "customer_id": "cust_xxx",
  "period": "2026-03",
  "mcu_usage": 1250,
  "tier_rate": 0.25
}
```

## Commands

```bash
/revenue pricing setup           # Create pricing tiers
/revenue billing status          # Check billing health
/revenue invoice generate        # Generate invoices
/revenue forecast 90             # 90-day revenue projection
/revenue analyze cohort          # Cohort analysis
```

## Related

- `/raas:billing` — Billing integration setup
- `/trading:dashboard` — Trading metrics
- `/finance` — Finance operations
