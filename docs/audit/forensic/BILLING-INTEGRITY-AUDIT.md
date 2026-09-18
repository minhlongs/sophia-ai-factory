# BILLING & PAYMENT INTEGRITY FORENSIC AUDIT

**Target:** Sophia AI Factory Billing, Webhook Ingestion & Subscription Architecture  
**Audit Standard:** Code is the authority. Tests are evidence.  
**Audit Date:** 2026-09-18  

---

## 1. Executive Summary

| Billing Boundary | Pre-Audit Finding | Status | Remediated Code Symbol / Proof |
|---|---|:---:|---|
| **Dynamic Checkout Fulfillment** | **P1 BUG:** `dispatchFinished` dropped dynamic SDK checkout invoices because they were not in static `NOWPAYMENTS_TIERS`. | **GREEN** | `src/land/billing/nowpayments-ipn-dispatch.ts`: Fallback checks `ipn.order_id` and routes to `handleFinished(ipn)`. Verified with unit & adversarial tests. |
| **Free $0 Enterprise Upgrade** | Vulnerability in Server Action `changeTierAction()` previously allowed direct D1 writes without payment. | **GREEN** | Fixed: `changeTierAction.ts:201-206` returns `UPGRADE_REQUIRES_PAYMENT` fail-closed. All upgrades must complete paid checkout. |
| **Webhook HMAC-SHA512 Security** | Edge runtime secret resolution failed if secret lived on `globalThis.__env`. | **GREEN** | `getNowPaymentsIpnSecret()` checks `globalThis.__env`, Cloudflare context, and `process.env`. |
| **Idempotency & Replay Defense** | Replay attacks could trigger duplicate subscription activation or credit granting. | **GREEN** | Atomic D1 lock via `INSERT INTO payment_events (...) ON CONFLICT(event_id) DO NOTHING` prevents concurrent race conditions. |
| **Underpayment / Overpayment** | Partial payments could activate subscriptions or overpayments could leak funds. | **GREEN** | `nowpayments-ipn-finished.ts`: Underpayment below threshold (`UNDERPAYMENT_THRESHOLD = 0.98`) is rejected; overpayments trigger audit log. |
| **Banned Billing Providers** | Polar.sh, PayPal banned by Sophia Constitution. | **GREEN** | Codebase exclusively uses NOWPayments (primary crypto) and PayOS (VN domestic). Zero Polar or PayPal billing routes. |

---

## 2. The Dynamic Invoice Anti-Drop Remediation

### The Root Cause
When a customer clicks checkout on `/pricing`, `POST /api/checkout` calls the NOWPayments SDK method `createCheckout()`. NOWPayments assigns a dynamic numeric invoice ID (e.g. `9999999999`) and returns a payment link.
When the customer completes payment, NOWPayments sends an IPN webhook with:
- `invoice_id`: `9999999999`
- `order_id`: `sophia_usr_12345_1720000000`

Prior to remediation, `dispatchFinished` in `nowpayments-ipn-dispatch.ts` evaluated:
```typescript
const lookup = lookupInvoice(invoiceId);
if (!lookup) {
  logger.warn('[IPNDispatch] finished: unknown invoice_id', ...);
  return; // DROPPED WITHOUT CALLING handleFinished!
}
```
Because `lookupInvoice` only inspected the 4 static pre-created invoice IDs in `NOWPAYMENTS_TIERS`, `lookup` was null for ALL dynamic SDK checkouts. The payment was acknowledged by NOWPayments, but Sophia dropped fulfillment silently!

### The Patch
```typescript
  if (!lookup) {
    if (ipn.order_id) {
      logger.info('[IPNDispatch] Dynamic invoice with order_id — routing to subscription handler', {
        invoiceId,
        orderId: ipn.order_id,
        paymentId: ipn.payment_id,
      });
      await throwOnError(handleFinished(ipn));
      return;
    }
    logger.warn('[IPNDispatch] finished: unknown invoice_id and no order_id', { invoiceId, paymentId: ipn.payment_id });
    return;
  }
```
`handleFinished(ipn)` resolves the order via `getOrderById(ipn.order_id)`, reads the user ID, tier, and billing period from `pending_orders`, and activates the subscription in D1.

### Automated Verification
- Verified in `src/land/billing/__tests__/nowpayments-ipn-dispatch.test.ts` (19/19 tests pass).
- Verified in `src/security-tests/adversarial-forensic.test.ts` (Case 1 pass).

---

## 3. Subscription Downgrade & Refund Protection

1. **Downgrade Timing:** Downgrades take effect at the end of the current billing cycle (`effectiveDate: sub.current_period_end`). The user keeps their current tier until the period expires.
2. **Account Credit:** Pro-rata unused days are computed via `calculateProRataCredit()` and credited to `user_profiles.settings.account_credit_cents`.
3. **Refund Webhook:** `dispatchRefunded()` marks the subscription cancelled or downgrades to `BASIC` and records a ledger transaction in `refund_events`.
