# ADR-0004 — NOWPayments and PayOS Are Payment Truth

**Status:** Accepted  
**Date:** 2026-06-18  
**Owner:** COO + CTO

## Context

Sophia billing uses NOWPayments for USDT/crypto subscription and one-time flows. PayOS is the Vietnam domestic backup. Polar.sh was rejected for this product.

## Decision

Sophia customer billing uses NOWPayments and PayOS only. Polar.sh and PayPal are banned for Sophia billing. Stripe is not a customer billing provider unless an approved affiliate payout/KYC flow requires it.

## Consequences

- Payment docs and UI copy must not advertise Polar/PayPal.
- Webhook handlers must be idempotent and signature-verified.
- Tier activation must occur only after confirmed payment.

## Evidence

- [`docs/admin-ops/payment-pricing-source-of-truth.md`](docs/admin-ops/payment-pricing-source-of-truth.md#L1-L50) — canonical billing providers and tiers.
- [`apps/sophia-ai-factory/CLAUDE.md`](apps/sophia-ai-factory/CLAUDE.md#L1-L89) — payment doctrine and banned providers.
