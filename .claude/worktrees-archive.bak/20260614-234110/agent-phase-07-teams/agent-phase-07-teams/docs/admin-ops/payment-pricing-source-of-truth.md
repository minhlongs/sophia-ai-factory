# Sophia Payment & Pricing Source of Truth

Last updated: 2026-05-13

## Canonical Rule

Sophia customer billing uses NOWPayments and PayOS only.

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
