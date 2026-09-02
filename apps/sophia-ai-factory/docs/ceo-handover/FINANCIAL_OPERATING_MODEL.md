# FINANCIAL OPERATING MODEL — SOPHIA AI FACTORY

> Baseline SHA: `5dd1f071` | Generated: 2026-09-02
> How money flows through Sophia, what the CEO can control, and what requires Tech Lead.

---

## Revenue Streams

| Stream | Source | Frequency | Tier Access |
|---|---|---|---|
| **Subscription (MRR)** | Tier fees (BASIC/PREMIUM/ENTERPRISE/MASTER) | Monthly recurring | All tiers |
| **Overage Billing** | MCU (Model Compute Units) beyond tier quota | Per billing cycle | All tiers |
| **Top-up Purchases** | Additional MCU packs | One-time | All tiers |
| **Affiliate Commissions** | Customer-referred revenue (ClickBank, Awin, etc.) | As earned | ENTERPRISE+ |
| **White-label / Enterprise** | Custom contracts | Per contract | MASTER only |

---

## Cost Structure

| Cost Category | Source | Frequency | Control |
|---|---|---|---|
| **AI Provider Costs** | OpenRouter, ElevenLabs, D-ID, HeyGen | Per mission execution | Customer BYOK (platform fallback tracked) |
| **Cloudflare Workers** | Requests + CPU time | Monthly | Platform ops |
| **Cloudflare D1** | Reads/writes/storage | Monthly | Platform ops |
| **Cloudflare R2** | Storage + operations | Monthly | Platform ops |
| **Inngest** | Workflow executions | Monthly | Platform ops |
| **NOWPayments Fees** | ~1% + network fees | Per transaction | Payment processor |
| **PayOS Fees** | Vietnam domestic | Per transaction | Payment processor |

---

## Tier Pricing (Current)

| Tier | Monthly | Annual | MCU Quota | Features |
|---|---|---|---|---|
| **BASIC** | $29 | $290 | 10,000 | Core features |
| **PREMIUM** | $79 | $790 | 50,000 | Advanced agents |
| **ENTERPRISE** | $299 | $2,990 | 200,000 | Affiliate, white-label |
| **MASTER** | Custom | Custom | Unlimited | Full access + support |

> Source: `src/seed/config/tiers/tier-configs.ts`

---

## Billing Flow

```
Customer selects tier
  → NOWPayments/PayOS checkout (webhook)
  → IPN received at /api/payments/nowpayments/ipn
  → verifyHash → tier activated in D1
  → User gets access immediately
```

**Key files:**
- `/api/payments/nowpayments/ipn/route.ts` — webhook handler
- `land/billing/actions/change-tier.ts` — Server Action for tier changes
- `land/billing/index.ts` — billing logic barrel

---

## Cost Tracking & Allocation

### AI Cost Tracking (AVAILABLE NOW)

- **Table:** `agent_cost_overrun` (per-mission provider spend)
- **Cron:** `/api/cron/agent-cost-overrun-scan/route.ts` — daily scan
- **Metrics:** Per-mission, per-provider, per-customer

### Infrastructure Cost (NOT ALLOCATED)

- Cloudflare bills: Workers + D1 + R2 + KV combined
- No per-customer or per-mission allocation exists
- **Gap:** Cannot calculate true gross margin per customer

---

## Gross Margin Calculation (Current)

```
Revenue (MRR + Overage + Top-ups)
  - AI Provider Costs (tracked per mission)
  = Gross Margin (platform-level)
  - Infrastructure (Cloudflare, Inngest, payment fees)
  = Net Margin
```

**Current visibility:** Can calculate revenue and AI costs. Infrastructure is platform-level aggregate.

---

## CEO Financial Authority (from DECISION_RIGHTS.md)

| Decision | CEO Authority |
|---|---|
| **Adjust pricing within tier bands** | ✅ CAN DECIDE |
| **Change base price per tier** | 🤝 MUST CONSULT TECH LEAD |
| **Discounts up to 10% per customer** | ✅ CAN DECIDE |
| **Discounts >10% or permanent** | 🤝 MUST CONSULT TECH LEAD |
| **Refunds up to $500** | ✅ CAN DECIDE |
| **Refunds >$500 or policy change** | 🤝 MUST CONSULT TECH LEAD |
| **Payment provider changes** | 🔴 MUST CONSULT TECH LEAD |

---

## Key Metrics for CEO Dashboard (from CEO_SCORECARD.md)

| Metric | Status | Where to Find |
|---|---|---|
| **MRR** | AVAILABLE NOW | Billing tables in D1 |
| **ARR Run Rate** | AVAILABLE NOW | MRR × 12 |
| **Revenue (30d)** | AVAILABLE NOW | `/api/analytics/revenue/` |
| **Refunds** | AVAILABLE NOW | `land/refunds/` |
| **Payment Failures** | AVAILABLE NOW | NOWPayments IPN + PayOS |
| **Gross Margin** | PARTIALLY AVAILABLE | Revenue - AI cost (infra not allocated) |
| **AI/Model Costs** | AVAILABLE NOW | `agent_cost_overrun` table |
| **Cost per Successful Mission** | PARTIALLY AVAILABLE | Needs join: AI cost / completed missions |
| **Contribution Margin/Customer** | PARTIALLY AVAILABLE | Needs allocation |

---

## Financial Operations Checklist

### Monthly (CEO)
- [ ] Review MRR / ARR trend
- [ ] Review refund rate + reasons
- [ ] Review payment failure rate
- [ ] Review AI cost per mission trend
- [ ] Approve any discounts >10%

### Quarterly (CEO + Tech Lead)
- [ ] Infrastructure cost review (Cloudflare invoice)
- [ ] Gross margin analysis
- [ ] Tier pricing competitiveness review
- [ ] Cost allocation feasibility assessment

### As Needed
- [ ] Customer refund requests (per DECISION_RIGHTS.md)
- [ ] Enterprise contract negotiation
- [ ] Payment provider issues

---

## Payment Provider Details

### NOWPayments (Primary)
- **Webhook:** `/api/payments/nowpayments/ipn/route.ts`
- **Auth:** IPN hash verification (`NOWPAYMENTS_IPN_SECRET`)
- **Currencies:** USD, EUR, crypto
- **Fee:** ~1% + network fee

### PayOS (Vietnam Backup)
- **Webhook:** `/api/payments/payos/ipn/route.ts`
- **Auth:** Signature verification
- **Currencies:** VND
- **Fee:** ~2.5%

### BANNED: Polar.sh, PayPal
Per `sophia-handover-rules.md` and `sophia-no-tech-doctrine.md`

---

## Financial Reporting

| Report | Frequency | Owner | Status |
|---|---|---|---|
| MRR / Revenue | Monthly | CEO | Manual (D1 query) |
| AI Cost Report | Daily (cron) | Auto | `/api/cron/agent-cost-overrun-scan/` |
| Payment Reconciliation | Monthly | CEO | Manual (NOWPayments dashboard) |
| Refund Report | Monthly | CEO | Manual (D1 query) |
| Infrastructure Cost | Monthly | Tech Lead | Cloudflare invoice |

---

## Gaps Requiring CEO Decision

1. **Infrastructure cost allocation** — Need per-customer cost attribution for true margin
2. **Experiment registry** — No A/B testing for pricing changes
3. **Customer LTV calculation** — Requires cohort data + churn definition
4. **Enterprise pricing model** — Custom pricing needs framework

---

## Recommendation

The CEO can operate financial decisions today using:
- D1 queries for MRR, revenue, refunds
- `agent_cost_overrun` table for AI costs
- NOWPayments dashboard for payment reconciliation

**Immediate gap:** Infrastructure cost per customer. Recommended: add per-request cost tracking in middleware + allocate proportionally.

*Generated by CEO HANDOVER AUDIT, Phase 11.*