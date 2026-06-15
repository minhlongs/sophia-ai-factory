# Phase 06 — Receipt Email on IPN Finished

## Context Links
- Resend service: `src/lib/billing/resend-email-service.ts`
- Email templates: `src/lib/email/email-templates.ts`, `onboarding-emails.ts`
- IPN handler: `src/lib/billing/nowpayments-ipn-subscription.ts` (handleFinished)
- Auto-handover (existing post-payment email): `src/lib/handover/auto-handover.ts`

## Overview
- Priority: P2
- Status: pending
- Effort: 30m
- Description: Add a dedicated receipt email separate from onboarding/handover. Includes invoice number, amount, payment method, period, tax notice, and support link. Triggered post-handleFinished (non-fatal).

## Key Insights
- DRY: Reuse Resend client + existing email template scaffolding (`renderTemplate`, `sendTransactional`).
- Receipt ≠ handover: handover is "here's your magic link", receipt is "here's proof you paid".
- Bilingual (vi + en) — match locale stored at user level (best-effort) or default to en.
- Crypto payments don't have VAT obligations in most jurisdictions; PayOS (VND) does → include conditional VAT line.

## Requirements

### Functional
- New template: `receiptEmail({ userEmail, userName?, tier, period, amountUsd, paymentId, paymentMethod, orderId, locale })`
- Subject line bilingual: "Receipt — Sophia AI Factory / Hóa đơn — Sophia AI Factory"
- Body includes: order_id, payment_id (truncated for safety), tier name, period, amount, payment method, date, support email
- Sent AFTER pending_orders.status flipped to completed (Phase 03)
- Failure to send is logged but does not throw (non-fatal)

### Non-Functional
- Render + send in <500ms (Resend API typically ~200ms)
- Idempotent: if same payment_id already received receipt, skip (track via `payment_events.receipt_sent` boolean)

## Architecture
```
handleFinished()
  └─ batch: subscription update + audit + pending_orders update
  └─ Onboarding video (existing, non-fatal)
  └─ Auto-handover (existing, non-fatal — magic link)
  └─ NEW: sendReceiptEmail(...) — non-fatal, awaited
      └─ if alreadySent(payment_id) → skip
      └─ render template → Resend POST → mark sent in payment_events
```

## Related Code Files

### Create
- `src/lib/billing/email/receipt-email-template.ts` — pure render function (HTML + text fallback)
- `src/lib/billing/email/receipt-email-sender.ts` — orchestrates: alreadySent check + render + send + mark
- `src/lib/billing/email/__tests__/receipt-email.test.ts` — 4 tests

### Modify
- `src/lib/billing/nowpayments-ipn-subscription.ts` — add `await sendReceiptEmail(...)` in try/catch after batch
- `migrations/0071-payment-events-receipt-flag.sql` — `ALTER TABLE payment_events ADD COLUMN receipt_sent INTEGER DEFAULT 0`

## Implementation Steps

1. Migration `0071-payment-events-receipt-flag.sql`:
   ```sql
   ALTER TABLE payment_events ADD COLUMN receipt_sent INTEGER DEFAULT 0;
   ```

2. Create `receipt-email-template.ts`:
   - Function `renderReceipt(input): { subject, html, text }`
   - Use template literals, no external deps
   - Bilingual based on `input.locale === 'vi'`
   - Format amount as `$199.00 USD`, truncate paymentId to first 8 chars

3. Create `receipt-email-sender.ts` (~80 lines):
   ```ts
   export async function sendReceiptEmail(input: ReceiptInput): Promise<void> {
     const db = getDb()
     const { data } = await db.from('payment_events').select('receipt_sent').eq('event_id', `nowpayments_${input.paymentId}`).single()
     if (data?.receipt_sent) return  // idempotent

     const { subject, html, text } = renderReceipt(input)
     await sendTransactionalEmail({ to: input.email, subject, html, text, tag: 'receipt' })

     await db.from('payment_events').update({ receipt_sent: 1 }).eq('event_id', `nowpayments_${input.paymentId}`)
   }
   ```

4. Wire into `handleFinished()`:
   ```ts
   try {
     const { data: userRow } = await db.from('user').select('email,name,locale').eq('id', userId).single()
     if (userRow?.email) {
       await sendReceiptEmail({
         email: userRow.email,
         userName: userRow.name,
         tier,
         period: isLifetime ? 'lifetime' : 'monthly',
         amountUsd: ipn.price_amount,
         paymentId: ipn.payment_id,
         paymentMethod: 'nowpayments',
         orderId: ipn.order_id ?? '',
         locale: userRow.locale ?? 'en',
       })
     }
   } catch (err) {
     logger.warn('[NOWPayments] Receipt email failed (non-fatal)', { userId, err: String(err) })
   }
   ```

5. Tests (`receipt-email.test.ts`):
   - Renders correct subject/html/text in en
   - Renders correct subject/html/text in vi
   - Idempotent: second call skips send when receipt_sent=1
   - Resend failure: logs and throws (caller catches)

## Todo List
- [ ] Create migration 0071 for receipt_sent flag
- [ ] Create receipt-email-template.ts (render only)
- [ ] Create receipt-email-sender.ts (idempotent send)
- [ ] Wire into handleFinished in nowpayments-ipn-subscription.ts
- [ ] Write 4 unit tests
- [ ] Manual: trigger sandbox IPN → confirm one receipt email arrives
- [ ] Build → 0 errors

## Success Criteria
- Receipt email arrives within 30s of IPN finished
- Replay IPN does NOT send second receipt
- Bilingual rendering correct (vi + en)
- 0 impact on existing handover email

## Risk Assessment
- Risk: Receipt sent before tier actually active (race) → mitigation: called after `db.batch()` completes
- Risk: User doesn't have locale field → mitigation: default `'en'`, optional column lookup
- Risk: Resend rate limits → mitigation: receipt is one per payment, not per user — natural rate limit

## Security Considerations
- Truncated paymentId in body (first 8 chars only) to avoid leaking full ID via screenshots
- No API keys or sensitive data in email body
- Tax notice generic — no specific VAT calculation (USD/crypto only for now)

## Next Steps
- Phase 07: Dashboard "View receipts" link (uses listOrdersByUser)
- Future: Receipt PDF attachment (deferred — adds complexity)
