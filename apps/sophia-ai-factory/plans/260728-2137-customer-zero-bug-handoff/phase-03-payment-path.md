# Phase 3 — Payment Path (Hours 4-7)
- Owner: Operator
- Dependencies: Phase 2 complete

## Requirements
- Customer tier activated (FREE100 or PAID)
- Payment webhook end-to-end verified
- DLQ empty

## Steps
1. If FREE100 trial: confirm tier = FREE100 in D1, skip payment
2. If PAID: create NOWPayments invoice → customer pays → IPN received
3. Verify IPN handler: payment_events row inserted + processed = 1
4. Verify user_purchases row: status = paid, tier updated
5. Verify tier guard: resolveUserTier returns correct tier
6. Check DLQ: SELECT count(*) FROM ipn_dead_letter_queue WHERE resolved = 0 → expect 0

## Validation
- GET /api/billing/usage-summary → 200 with customer data
- D1 query: SELECT tier FROM user_profiles WHERE user_id = ? → FREE100 or PAID value
- D1 query: SELECT * FROM payment_events WHERE event_id LIKE 'nowpayments_%' → processed = 1

## Risk: IPN_NOT_RECEIVED
- Symptom: customer pays but tier stays FREE
- Fix: Check NOWPayments IPN URL config, webhook secret, firewall rules

## Risk: DLQ_BACKLOG
- Symptom: payment_events processed = 0, DLQ count > 0
- Fix: Check Inngest / worker logs for IPN handler errors
