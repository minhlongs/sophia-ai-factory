# 260722-03 Customer Checkout Review

## Objective
Add an explicit review/activate step for pending orders created via `/api/checkout`, preventing silent order failure from blocking first paying customer proof.

## Scope
- Preserve NOWPayments + PayOS checkout behavior.
- Encode safe operator-approved handling for:
  - Amount mismatches within tolerance
  - Signature-verified but unmatched IPNs
  - Timeout/idempotency edge cases

## Current signature
- Checkout writes pending orders before redirecting.
- IPN routes are idempotent but lack a review queue when matching fails.
