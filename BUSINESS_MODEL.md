# BUSINESS_MODEL.md

## One-Line Model

Sophia sells no-code AI video and revenue automation to non-technical CEOs and agencies. Customers pay subscription or one-time fees and bring their own third-party API keys, keeping platform gross margin high.

## Target Customer

- Vietnamese and English-speaking non-technical CEOs.
- Marketing agencies running faceless YouTube channels.
- Affiliate operators needing repeatable content and distribution.
- Buyers who want AI automation without hiring technical staff.

## Product Offers

| Offer | Tier | Price | Billing | Buyer |
|---|---:|---:|---|---|
| Starter | BASIC | $199/mo | Subscription | Small businesses testing AI video |
| Growth | PREMIUM | $399/mo | Subscription | Growing teams producing weekly video |
| Premium | ENTERPRISE | $799/mo | Subscription | Agencies and automation-heavy teams |
| Master | MASTER | $4,999 | One-time handover/source-code buyers | White-label/source-code buyers |

Source of truth: `docs/admin-ops/payment-pricing-source-of-truth.md:13-28`.

## Payment Providers

- NOWPayments: primary USDT/crypto checkout.
- PayOS: Vietnam domestic backup.
- Polar.sh and PayPal are banned for Sophia customer billing.
- Stripe is only for approved affiliate payout/KYC flows, not standard customer billing.

## Revenue Streams

1. Monthly subscriptions.
2. One-time MASTER/source-code handover.
3. Potential one-time video credit bundles if re-enabled intentionally.
4. Future affiliate revenue share only after payout obligations are understood.

## Cost Structure

### Platform COGS

- Cloudflare Workers/D1/R2/KV: low at early scale.
- Email via Resend: low per message.
- Inngest and provider APIs: customer BYOK shifts most AI/video costs to customer.
- Support: main variable cost until onboarding is self-serve.

### Business Costs

- Founder sales/demo time.
- Customer onboarding/support.
- Payment fees and reconciliation.
- Affiliate payouts if offered.
- Compliance/legal as claims mature.

## Unit Economics Hypothesis

BASIC tier:

- Revenue: $199/mo.
- Platform infra: near-zero at early scale.
- API costs: customer-paid under BYOK.
- Support: target below $10–$30/mo/customer once onboarding is stable.
- Gross margin target: >90% after support.

## Sales Motion

1. Identify warm leads: Vietnamese agencies, content creators, operators.
2. Demo full flow: signup → BYOK → payment → tier activation → first video.
3. Close BASIC tier with 1-month support.
4. Convert successful operators to PREMIUM/ENTERPRISE.
5. Sell MASTER only to buyers who understand handover/source-code economics.

## Validation Milestones

- 1 paying customer.
- 3 referenceable customers.
- BASIC tier unit economics proven.
- Support time per customer trending down.
- Repeatable acquisition channel identified.

## Business Risks

- Customers expect Sophia to operate third-party APIs for them.
- Payment/IPN failures block activation.
- AI/video provider downtime hurts perceived reliability.
- Overpromising SLA/compliance before operational proof.
- Affiliate payout obligations reduce margin if not modeled.
