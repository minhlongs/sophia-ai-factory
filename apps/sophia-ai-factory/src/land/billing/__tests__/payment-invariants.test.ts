/**
 * Payment Invariants & Customer Journey Security Tests.
 *
 * Enforces Phase 6 critical financial invariants:
 * 1. 1 payment -> 1 fulfillment (idempotency: replayed webhooks do not double-fulfill)
 * 2. Wrong customer -> no fulfillment (invalid/missing customer ID rejects activation)
 * 3. Wrong tier / wrong amount -> no unauthorized entitlement (deviation threshold rejection)
 * 4. Replay attack / duplicate lock handling -> fail-safe non-destructive exit
 *
 * @module land/billing/__tests__/payment-invariants.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processNowPaymentsIpn, type NowPaymentsIpnPayload } from '../nowpayments-ipn-handlers';
import { handleFinished } from '../nowpayments-ipn-finished';

// ── Spies & Mocks ────────────────────────────────────────────────────────────

const dispatchFinishedSpy = vi.fn().mockResolvedValue(undefined);
const dispatchRefundedSpy = vi.fn().mockResolvedValue(undefined);
const handleFailedSpy = vi.fn().mockResolvedValue({ ok: true });

vi.mock('../nowpayments-ipn-dispatch', () => ({
  dispatchFinished: (...args: unknown[]) => dispatchFinishedSpy(...args),
  dispatchRefunded: (...args: unknown[]) => dispatchRefundedSpy(...args),
}));

vi.mock('../nowpayments-ipn-subscription', () => ({
  handleFailed: (...args: unknown[]) => handleFailedSpy(...args),
  handleFinished: vi.fn().mockResolvedValue(undefined),
  handleRefunded: vi.fn().mockResolvedValue(undefined),
}));

// In-memory payment_events table store
const mockPaymentEvents = new Map<string, { event_id: string; processed: number; created_at: string }>();

function buildMockDb() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'pending_orders') {
        return {
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        };
      }
      if (table === 'audit_log') {
        return {
          insert: vi.fn(async () => ({ error: null })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      };
    }),
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...args: unknown[]) => {
        const eventId = args[0] as string;
        return {
          run: vi.fn(async () => {
            if (sql.includes('INSERT INTO payment_events')) {
              if (mockPaymentEvents.has(eventId)) {
                // Duplicate — ON CONFLICT DO NOTHING: 0 changes
                return { meta: { changes: 0 } };
              }
              mockPaymentEvents.set(eventId, {
                event_id: eventId,
                processed: 0,
                created_at: new Date().toISOString(),
              });
              return { meta: { changes: 1 } };
            }
            if (sql.includes('UPDATE payment_events SET processed = 1')) {
              const row = mockPaymentEvents.get(eventId);
              if (row) row.processed = 1;
              return { meta: { changes: 1 } };
            }
            if (sql.includes('UPDATE payment_events SET processed = 2')) {
              return { meta: { changes: 0 } };
            }
            return { meta: { changes: 1 } };
          }),
          first: vi.fn(async () => {
            const row = mockPaymentEvents.get(eventId);
            return row ? { processed: row.processed, created_at: row.created_at } : null;
          }),
        };
      }),
    })),
  };
}

vi.mock('../nowpayments-ipn-db', () => ({
  getDb: vi.fn(() => buildMockDb()),
  parseUserIdFromOrderId: vi.fn((orderId: string) => {
    if (!orderId || orderId.startsWith('invalid')) return null;
    // e.g. "usr_123_order456" -> "usr_123"
    const match = orderId.match(/^(usr_[a-zA-Z0-9]+)/);
    return match ? match[1] : (orderId === 'unknown' ? null : 'usr_default');
  }),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn().mockResolvedValue({
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ id: 'org_123' }),
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      }),
    }),
  }),
}));

vi.mock('@/tree/clients/nowpayments-client', () => ({
  getTierByInvoiceId: vi.fn((invoiceId: string) => {
    if (invoiceId === 'inv_premium') return { tier: 'PREMIUM', invoiceId };
    if (invoiceId === 'inv_master') return { tier: 'MASTER', invoiceId };
    return null;
  }),
  NOWPAYMENTS_TIERS: {
    PREMIUM: { price: 399, yearlyPrice: 3990 },
    MASTER: { price: 4999, yearlyPrice: 49990 },
  },
}));

vi.mock('../nowpayments-subscription-activate', () => ({
  activateSubscriptionForOrg: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../nowpayments-post-purchase', () => ({
  runPostActivationWorkflow: vi.fn().mockResolvedValue(undefined),
}));

describe('Phase 6: Payment Invariant & Customer Journey Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPaymentEvents.clear();
  });

  // ── INVARIANT 1: 1 Payment -> 1 Fulfillment (Idempotency) ──────────────────
  it('enforces 1 payment -> 1 fulfillment on duplicate IPN replay', async () => {
    const payload: NowPaymentsIpnPayload = {
      payment_id: 'pay_1001',
      payment_status: 'finished',
      price_amount: 399,
      price_currency: 'usd',
      order_id: 'usr_abc_1690000000',
      invoice_id: 'inv_premium',
    };

    // First arrival: processes cleanly and acquires atomic lock
    const firstResult = await processNowPaymentsIpn(payload);
    expect(firstResult.success).toBe(true);
    expect(firstResult.message).toBe('Processed finished');
    expect(dispatchFinishedSpy).toHaveBeenCalledTimes(1);

    // Second arrival (replay attack / duplicate webhook delivery)
    const secondResult = await processNowPaymentsIpn(payload);
    expect(secondResult.success).toBe(true);
    expect(secondResult.message).toBe('Already processed');

    // CRITICAL: Fulfillment dispatcher MUST NOT be called a second time
    expect(dispatchFinishedSpy).toHaveBeenCalledTimes(1);
  });

  // ── INVARIANT 2: Replay Rejection When Already Processed ───────────────────
  it('rejects replayed event when payment_events shows processed = 1', async () => {
    const eventId = 'nowpayments_pay_already_finished';
    mockPaymentEvents.set(eventId, {
      event_id: eventId,
      processed: 1,
      created_at: new Date().toISOString(),
    });

    const payload: NowPaymentsIpnPayload = {
      payment_id: 'pay_already',
      payment_status: 'finished',
      price_amount: 399,
      price_currency: 'usd',
      order_id: 'usr_abc_order',
    };

    const res = await processNowPaymentsIpn(payload);
    expect(res.success).toBe(true);
    expect(res.message).toBe('Already processed');
    expect(dispatchFinishedSpy).not.toHaveBeenCalled();
  });

  // ── INVARIANT 3: Wrong Customer -> No Fulfillment ──────────────────────────
  it('rejects fulfillment when customer cannot be verified from order_id', async () => {
    const { activateSubscriptionForOrg } = await import('../nowpayments-subscription-activate');

    const invalidCustomerPayload: NowPaymentsIpnPayload = {
      payment_id: 'pay_wrong_customer',
      payment_status: 'finished',
      price_amount: 399,
      price_currency: 'usd',
      order_id: 'invalid_no_matching_user_pattern',
      invoice_id: 'inv_premium',
    };

    const result = await handleFinished(invalidCustomerPayload);
    expect(result.ok).toBe(true);
    // Subscription activation MUST NOT be invoked without a verified userId
    expect(activateSubscriptionForOrg).not.toHaveBeenCalled();
  });

  // ── INVARIANT 4: Wrong Amount / Underpayment -> Rejects Activation ─────────
  it('rejects subscription activation if payment amount deviates from expected tier price', async () => {
    const { activateSubscriptionForOrg } = await import('../nowpayments-subscription-activate');

    const wrongAmountPayload: NowPaymentsIpnPayload = {
      payment_id: 'pay_tampered_amount',
      payment_status: 'finished',
      // Premium tier expected price is 399, sending 100
      price_amount: 100,
      price_currency: 'usd',
      order_id: 'usr_valid_order',
      invoice_id: 'inv_premium',
    };

    const result = await handleFinished(wrongAmountPayload);
    expect(result.ok).toBe(true);
    // Tampered or mismatched price MUST NOT activate subscription
    expect(activateSubscriptionForOrg).not.toHaveBeenCalled();
  });

  it('rejects subscription activation if actually_paid is below underpayment threshold', async () => {
    const { activateSubscriptionForOrg } = await import('../nowpayments-subscription-activate');

    const underpaidPayload: NowPaymentsIpnPayload = {
      payment_id: 'pay_underpaid',
      payment_status: 'finished',
      price_amount: 399,
      price_currency: 'usd',
      actually_paid: 200, // < 95% threshold of 399
      order_id: 'usr_valid_order',
      invoice_id: 'inv_premium',
    };

    const result = await handleFinished(underpaidPayload);
    expect(result.ok).toBe(true);
    expect(activateSubscriptionForOrg).not.toHaveBeenCalled();
  });

  // ── INVARIANT 5: Unknown Invoice / Tier -> No Fulfillment ───────────────────
  it('rejects fulfillment when invoice ID does not map to any known tier', async () => {
    const { activateSubscriptionForOrg } = await import('../nowpayments-subscription-activate');

    const unknownInvoicePayload: NowPaymentsIpnPayload = {
      payment_id: 'pay_unknown_inv',
      payment_status: 'finished',
      price_amount: 399,
      price_currency: 'usd',
      order_id: 'usr_valid_order',
      invoice_id: 'inv_non_existent',
    };

    const result = await handleFinished(unknownInvoicePayload);
    expect(result.ok).toBe(true);
    expect(activateSubscriptionForOrg).not.toHaveBeenCalled();
  });
});
