# Sophia Payment & Pricing Source of Truth

Last updated: 2026-05-13

## Canonical Rule

Sophia automated customer billing uses NOWPayments and PayOS. The separate Option A pilot supports a manually verified bank settlement flow; a reservation or bank memo alone never proves payment.

- NOWPayments: crypto/USDT checkout.
- PayOS: VietQR and Vietnam bank transfer checkout.
- Do not use Polar or PayPal for Sophia customer billing.
- Stripe is not a customer billing provider. Only use Stripe if an approved affiliate payout/KYC flow requires it.

## Current Plans

| Plan | Internal Tier | Price | Billing Type | Primary Buyer |
|---|---|---:|---|---|
| Starter | BASIC | $199/month | Subscription | Small businesses testing AI video |
| Growth | PREMIUM | $399/month | Subscription | Growing teams producing weekly video |
| Premium | ENTERPRISE | $799/month | Subscription | Agencies and enterprises needing automation/API |
| Master | MASTER | $4,999 one-time | One-time handover | White-label/source-code buyers |

Canonical pricing references:

- `README.md`
- `.mekong/company.json`
- `docs/pricing-and-tiers.md`
- `docs/handover/README.md`

## Change Protocol

1. Update tier config in application code if price IDs or tier metadata change.
2. Update the four canonical pricing references above.
3. Update checkout copy and any landing/pricing components.
4. Run payment webhook/checkout smoke tests.
5. Record the change in `docs/project-changelog.md` if present.

## Go-Live Verification

Before marking billing ready:

- NOWPayments checkout creates a valid invoice for each paid plan.
- PayOS checkout creates a valid payment link or VietQR flow for Vietnam buyers.
- Webhook signature verification is enabled for every active provider.
- Account activation occurs only after confirmed payment.
- Failed, expired, duplicate, and replayed webhook events are handled safely.
- Customer-facing docs do not mention Polar/PayPal as active billing paths.

## Owner

Operations owner keeps this document aligned with production configuration. Engineering owns webhook verification and application tier config.

## Option A pilot — additive exception (2026-11-19)

The canonical contract is `src/seed/config/tiers/option-a-pilot-contract.ts`.
`BASIC_PILOT_14D` / `pilot_14d` costs 1,990,000 VND and grants 500 MCU once,
14 calendar days in Asia/Saigon, 0 Cloud video renders and no auto-renewal.
BYOK provider fees are separate. Existing higher and grandfathered benefits remain intact.

A request within 7 days qualifies regardless of MCU usage. A request within 14 days
qualifies for a Sophia-verified Option A campaign/script delivery failure.
Refund 100% of the amount Sophia actually received, not a synthetic exchange-rate value.
Third-party BYOK charges are excluded; statutory rights remain unchanged.
These are pilot-only rules, not changes to the standard or MASTER policies above.

Activation requires independently verified bank evidence, reconciliation and admin
approval. A receipt requires ACTIVE_14D and the actual settled currency/amount.
A refund is not paid until independently evidenced SETTLED status. Revoke only remaining
pilot-sourced credits/access, never unrelated purchased credits or higher benefits.

### Preserved standard refund entitlement

BASIC/PREMIUM/ENTERPRISE retain the existing 30-day request window; MASTER retains
14 days. No reliable purchase-policy version/cutoff was established, so no standard
customer is silently moved to a 7-day window. The 7-day goodwill window applies only
to `pilot_14d`; a legacy standard request on day 10 remains within its window.
