/**
 * IPN Dispatcher Tests — 16 cases covering subscription + one-time routing
 * Matrix: 4 subscription tiers × 2 outcomes + 1 one-time SKU × 2 outcomes + 4 edge cases + 2 status branches
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { dispatchFinished, dispatchRefunded } from '../nowpayments-ipn-dispatch'
import { dispatchPaymentStatus } from '../ipn-handlers/status-dispatcher'
import * as subscriptionHandler from '../nowpayments-ipn-subscription'
import * as oneTimeHandler from '../nowpayments-ipn-one-time'
import * as nowpaymentsClient from '@/tree/clients/nowpayments-client'
import * as contractConverter from '@/land/contracts/workflow/contract-converter'
import * as contractRefund from '@/land/contracts/workflow/nowpayments-contract-refund'
import * as contractFulfillment from '@/land/contracts/workflow/nowpayments-contract-fulfillment'
import type { D1Client } from '@/seed/db/d1-client-rpc'
import type { NowPaymentsIpnPayload } from '../nowpayments-ipn-handlers'
import type { OneTimeSku } from '@/seed/types'

// Mock modules
vi.mock('@/tree/clients/nowpayments-client')
vi.mock('../nowpayments-ipn-subscription')
vi.mock('../nowpayments-ipn-one-time')
vi.mock('@/land/contracts/workflow/contract-converter')
vi.mock('@/land/contracts/workflow/nowpayments-contract-refund')
vi.mock('@/land/contracts/workflow/nowpayments-contract-fulfillment')

// Helper to build IPN payload
function buildIpnPayload(overrides: Partial<NowPaymentsIpnPayload> = {}): NowPaymentsIpnPayload {
  return {
    payment_id: 'pay_' + Math.random().toString(36).slice(2),
    invoice_id: '5710519960',
    order_id: 'sophia_user1_1234567890',
    payment_status: 'finished',
    price_amount: 199,
    price_currency: 'usd',
    ...overrides,
  }
}

describe('dispatchFinished — subscription + one-time routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it.each(['expired', 'failed'] as const)('routes a late finished contract payment from %s to contract fulfillment only', async (status) => {
    const payload = buildIpnPayload({ payment_id: 'late-contract-payment', invoice_id: 'provider-invoice-1',
      order_id: 'contract-order-1', price_amount: 3500, price_currency: 'USD', actually_paid: 0.005, pay_amount: 0.005 });
    const order = { order_id: 'contract-order-1', user_id: 'buyer-1', contract_id: 'contract-1',
      invoice_id: 'invoice-1', amount_usd_cents: 350000, provider_payment_id: 'provider-invoice-1' };
    const db = { prepare: (sql: string) => ({ bind: () => ({ first: async () =>
      sql.includes('pending_orders') ? order : sql.includes('payment_events') ? { created_at: 'lock-1' } :
        { total_amount_cents: 350000, currency: 'USD' } }) }), unwrap: () => ({}) } as unknown as D1Client;
    vi.mocked(contractConverter.getContractById).mockResolvedValue({ id: 'contract-1', orgId: 'org-1',
      lastInvoiceId: 'invoice-1', mcuCapacityMonthly: 50000, status: 'signed' } as never);
    vi.mocked(contractFulfillment.fulfillNowPaymentsContractOrder).mockResolvedValue(undefined);

    await dispatchFinished(payload, db);

    expect(contractFulfillment.fulfillNowPaymentsContractOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      orderId: 'contract-order-1', paymentId: 'late-contract-payment',
    }));
    expect(subscriptionHandler.handleFinished).not.toHaveBeenCalled();
  })

  // ─── Subscription Cases (1-4): Finished ────────────────────────────────────

  it('case 1: BASIC tier finished → subscription handler', async () => {
    const payload = buildIpnPayload({ invoice_id: '5710519960' })
    const config = {
      kind: 'subscription' as const,
      tier: 'BASIC' as const,
      config: {
        tier: 'BASIC' as const,
        invoiceId: '5710519960',
        yearlyInvoiceId: '5710519960',
        price: 199,
        yearlyPrice: 1990,
        currency: 'USD',
        name: 'Starter',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
    expect(oneTimeHandler.handleOneTimeFinished).not.toHaveBeenCalled()
  })

  it('case 2: PREMIUM tier finished → subscription handler', async () => {
    const payload = buildIpnPayload({ invoice_id: '4559269964' })
    const config = {
      kind: 'subscription' as const,
      tier: 'PREMIUM' as const,
      config: {
        tier: 'PREMIUM' as const,
        invoiceId: '4559269964',
        yearlyInvoiceId: '4559269964',
        price: 399,
        yearlyPrice: 3990,
        currency: 'USD',
        name: 'Growth',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  it('case 3: ENTERPRISE tier finished → subscription handler', async () => {
    const payload = buildIpnPayload({ invoice_id: '6336799275' })
    const config = {
      kind: 'subscription' as const,
      tier: 'ENTERPRISE' as const,
      config: {
        tier: 'ENTERPRISE' as const,
        invoiceId: '6336799275',
        yearlyInvoiceId: '6336799275',
        price: 799,
        yearlyPrice: 7990,
        currency: 'USD',
        name: 'Premium',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  it('case 4: MASTER tier finished → subscription handler', async () => {
    const payload = buildIpnPayload({ invoice_id: '5589879034' })
    const config = {
      kind: 'subscription' as const,
      tier: 'MASTER' as const,
      config: {
        tier: 'MASTER' as const,
        invoiceId: '5589879034',
        yearlyInvoiceId: '5589879034',
        price: 4999,
        yearlyPrice: 0,
        currency: 'USD',
        name: 'Master',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  // ─── One-Time Cases (9): Finished ──────────────────────────────────────────

  it('case 9: STARTER_BUNDLE one_time finished → one-time handler', async () => {
    const payload = buildIpnPayload({ invoice_id: '7810429001' })
    const sku: OneTimeSku = {
      id: 'STARTER_BUNDLE',
      invoiceId: '7810429001',
      priceUsd: 49,
      credits: 10,
      ttlMonths: 12,
      label_vi: 'Gói Khởi Đầu',
      label_en: 'Starter Bundle',
    }
    const config = { kind: 'one_time' as const, sku }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(oneTimeHandler.handleOneTimeFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(oneTimeHandler.handleOneTimeFinished).toHaveBeenCalledWith(payload, sku)
    expect(subscriptionHandler.handleFinished).not.toHaveBeenCalled()
  })

  // ─── Edge Cases (11-14): Finished ──────────────────────────────────────────

  it('case 11: unknown invoice_id with no order_id → log warn, no handler call', async () => {
    const payload = buildIpnPayload({ invoice_id: 'unknown_9999999999', order_id: undefined })
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(null)

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).not.toHaveBeenCalled()
    expect(oneTimeHandler.handleOneTimeFinished).not.toHaveBeenCalled()
  })

  it('case 11b: dynamic SDK checkout with unknown invoice_id but valid order_id → dispatches to subscription handler', async () => {
    const payload = buildIpnPayload({ invoice_id: 'dynamic_sdk_99999', order_id: 'sophia_user1_1234567890' })
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(null)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
    expect(oneTimeHandler.handleOneTimeFinished).not.toHaveBeenCalled()
  })

  it('case 12: malformed order_id → still dispatch based on invoice_id', async () => {
    const payload = buildIpnPayload({ invoice_id: '5710519960', order_id: 'malformed' })
    const config = {
      kind: 'subscription' as const,
      tier: 'BASIC' as const,
      config: {
        tier: 'BASIC' as const,
        invoiceId: '5710519960',
        yearlyInvoiceId: '5710519960',
        price: 199,
        yearlyPrice: 1990,
        currency: 'USD',
        name: 'Starter',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    // Dispatcher routes based on invoice_id, not order_id validation — handler validates order_id
    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  it('case 13: missing invoice_id → fall through to subscription handler', async () => {
    const payload = buildIpnPayload({ invoice_id: undefined })
    vi.mocked(subscriptionHandler.handleFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    // No invoice_id — fall through to subscription (backward compat)
    expect(subscriptionHandler.handleFinished).toHaveBeenCalledWith(payload)
  })

  it('case 14: missing payment_id → still processes', async () => {
    const payload = buildIpnPayload({ invoice_id: '7810429001', payment_id: '' })
    const sku: OneTimeSku = {
      id: 'STARTER_BUNDLE',
      invoiceId: '7810429001',
      priceUsd: 49,
      credits: 10,
      ttlMonths: 12,
      label_vi: 'Gói Khởi Đầu',
      label_en: 'Starter Bundle',
    }
    const config = { kind: 'one_time' as const, sku }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(oneTimeHandler.handleOneTimeFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(oneTimeHandler.handleOneTimeFinished).toHaveBeenCalled()
  })

  // ─── Status Branch Cases (15-16): Finished ────────────────────────────────

  it('case 15: payment_status=failed → no special handling (payload passed as-is)', async () => {
    const payload = buildIpnPayload({
      invoice_id: '7810429001',
      payment_status: 'failed',
    })
    const sku: OneTimeSku = {
      id: 'STARTER_BUNDLE',
      invoiceId: '7810429001',
      priceUsd: 49,
      credits: 10,
      ttlMonths: 12,
      label_vi: 'Gói Khởi Đầu',
      label_en: 'Starter Bundle',
    }
    const config = { kind: 'one_time' as const, sku }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(oneTimeHandler.handleOneTimeFinished).mockResolvedValue({ ok: true, value: undefined })

    // Dispatcher doesn't filter by payment_status — routes based on invoice_id
    await dispatchFinished(payload)

    expect(oneTimeHandler.handleOneTimeFinished).toHaveBeenCalled()
  })

  it('case 16: payment_status=expired → no special handling', async () => {
    const payload = buildIpnPayload({
      invoice_id: '7810429001',
      payment_status: 'expired',
    })
    const sku: OneTimeSku = {
      id: 'STARTER_BUNDLE',
      invoiceId: '7810429001',
      priceUsd: 49,
      credits: 10,
      ttlMonths: 12,
      label_vi: 'Gói Khởi Đầu',
      label_en: 'Starter Bundle',
    }
    const config = { kind: 'one_time' as const, sku }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(oneTimeHandler.handleOneTimeFinished).mockResolvedValue({ ok: true, value: undefined })

    await dispatchFinished(payload)

    expect(oneTimeHandler.handleOneTimeFinished).toHaveBeenCalled()
  })
})

describe('dispatchRefunded — subscription + one-time refund routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('routes a persisted contract refund to contract reversal instead of SaaS cancellation', async () => {
    const payload = buildIpnPayload({
      payment_id: 'contract-payment-1', invoice_id: 'provider-invoice-1',
      order_id: 'contract-order-1', payment_status: 'refunded',
      price_amount: 3500, price_currency: 'USD',
    });
    const row = {
      order_id: 'contract-order-1', user_id: 'buyer-1', contract_id: 'contract-1',
      invoice_id: 'invoice-1', amount_usd_cents: 350000,
      provider_payment_id: 'provider-invoice-1', status: 'completed', payment_id: 'contract-payment-1',
    };
    const firstQueries = vi.fn();
    vi.mocked(contractConverter.getContractById).mockResolvedValue({
      id: 'contract-1', orgId: 'org-1', lastInvoiceId: 'invoice-1', mcuCapacityMonthly: 50000,
    } as never);
    const db = {
      prepare: (sql: string) => {
      const statement = {
        bind: (...args: unknown[]) => ({
          first: async () => {
            firstQueries(sql, args);
            if (sql.includes('pending_orders')) return row;
            if (sql.includes('payment_events')) return { created_at: 'refund-lock-1' };
            if (sql.includes('mcu_transactions')) return { payment_reference: 'contract-payment-1' };
            return { total_amount_cents: 350000, currency: 'USD', status: 'paid' };
          },
        }),
      };
      return statement;
      },
      unwrap: () => ({}),
    } as unknown as D1Client;
    vi.mocked(contractRefund.refundNowPaymentsContractOrder).mockResolvedValue(undefined);

    await dispatchRefunded(payload, db);

    expect(contractRefund.refundNowPaymentsContractOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      orderId: 'contract-order-1', invoiceId: 'invoice-1', paymentId: 'contract-payment-1',
      providerInvoiceId: 'provider-invoice-1', wasCompleted: true,
    }));
    expect(subscriptionHandler.handleRefunded).not.toHaveBeenCalled();
    expect(firstQueries).toHaveBeenCalledTimes(4);
  });

  it('correlates a refund without order_id by its unique persisted payment identity', async () => {
    const payload = buildIpnPayload({ payment_id: 'contract-payment-1', invoice_id: 'provider-invoice-1',
      order_id: '', payment_status: 'refunded', price_amount: 3500, price_currency: 'USD' });
    const row = { order_id: 'contract-order-1', user_id: 'buyer-1', contract_id: 'contract-1',
      invoice_id: 'invoice-1', amount_usd_cents: 350000, provider_payment_id: 'provider-invoice-1',
      status: 'completed', payment_id: 'contract-payment-1' };
    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          all: async () => ({ results: sql.includes('pending_orders') ? [{ order_id: row.order_id }] : [] }),
          first: async () => sql.includes('pending_orders') ? row :
            sql.includes('payment_events') ? { created_at: 'refund-lock-1' } :
              sql.includes('mcu_transactions') ? { payment_reference: 'contract-payment-1' } :
                { total_amount_cents: 350000, currency: 'USD', status: 'paid' },
        }),
      }),
      unwrap: () => ({}),
    } as unknown as D1Client;
    vi.mocked(contractConverter.getContractById).mockResolvedValue({
      id: 'contract-1', orgId: 'org-1', lastInvoiceId: 'invoice-1', mcuCapacityMonthly: 50000,
    } as never);
    vi.mocked(contractRefund.refundNowPaymentsContractOrder).mockResolvedValue(undefined);

    await dispatchRefunded(payload, db);

    expect(contractRefund.refundNowPaymentsContractOrder).toHaveBeenCalledWith(expect.anything(),
      expect.objectContaining({ orderId: 'contract-order-1', paymentId: 'contract-payment-1', wasCompleted: true }));
    expect(subscriptionHandler.handleRefunded).not.toHaveBeenCalled();
  });

  it('fails retryably when a refund without order_id matches multiple contract orders', async () => {
    const payload = buildIpnPayload({ payment_id: 'shared-payment', invoice_id: 'provider-invoice-1',
      order_id: '', payment_status: 'refunded' });
    const db = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [
      { order_id: 'contract-order-1' }, { order_id: 'contract-order-2' },
    ] }) }) }) } as unknown as D1Client;

    await expect(dispatchRefunded(payload, db)).rejects.toThrow(/correlation is ambiguous/);
    expect(subscriptionHandler.handleRefunded).not.toHaveBeenCalled();
  });

  it('routes a refund for an expired contract order without invoking SaaS cancellation', async () => {
    const payload = buildIpnPayload({ payment_id: 'expired-payment', invoice_id: 'provider-invoice-1',
      order_id: 'contract-order-1', payment_status: 'refunded', price_amount: 3500, price_currency: 'USD' });
    const row = {
      order_id: 'contract-order-1', user_id: 'buyer-1', contract_id: 'contract-1', invoice_id: 'invoice-1',
      amount_usd_cents: 350000, provider_payment_id: null, status: 'expired', payment_id: null,
    };
    const db = {
      prepare: (sql: string) => ({ bind: () => ({ first: async () => sql.includes('pending_orders') ? row :
        sql.includes('payment_events') ? { created_at: 'refund-lock-1' } :
          sql.includes('mcu_transactions') ? null : { total_amount_cents: 350000, currency: 'USD', status: 'draft' } }) }),
      unwrap: () => ({}),
    } as unknown as D1Client;
    vi.mocked(contractConverter.getContractById).mockResolvedValue({
      id: 'contract-1', orgId: 'org-1', lastInvoiceId: 'invoice-1', mcuCapacityMonthly: 50000,
    } as never);
    vi.mocked(contractRefund.refundNowPaymentsContractOrder).mockResolvedValue(undefined);

    await dispatchRefunded(payload, db);

    expect(contractRefund.refundNowPaymentsContractOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      orderStatus: 'expired', wasCompleted: false, providerInvoiceId: 'provider-invoice-1',
    }));
    expect(subscriptionHandler.handleRefunded).not.toHaveBeenCalled();
  });

  it('detects completed fulfillment from paid invoice and MCU ledger after a stale expiry callback', async () => {
    const payload = buildIpnPayload({ payment_id: 'completed-payment', invoice_id: 'provider-invoice-1',
      order_id: 'contract-order-1', payment_status: 'refunded', price_amount: 3500, price_currency: 'USD' });
    const row = {
      order_id: 'contract-order-1', user_id: 'buyer-1', contract_id: 'contract-1', invoice_id: 'invoice-1',
      amount_usd_cents: 350000, provider_payment_id: 'provider-invoice-1', status: 'expired',
      payment_id: 'completed-payment',
    };
    const db = {
      prepare: (sql: string) => ({ bind: () => ({ first: async () => sql.includes('pending_orders') ? row :
        sql.includes('payment_events') ? { created_at: 'refund-lock-1' } :
          sql.includes('mcu_transactions') ? { payment_reference: 'completed-payment' } :
            { total_amount_cents: 350000, currency: 'USD', status: 'paid' } }) }),
      unwrap: () => ({}),
    } as unknown as D1Client;
    vi.mocked(contractConverter.getContractById).mockResolvedValue({
      id: 'contract-1', orgId: 'org-1', lastInvoiceId: 'invoice-1', mcuCapacityMonthly: 50000,
    } as never);
    vi.mocked(contractRefund.refundNowPaymentsContractOrder).mockResolvedValue(undefined);

    await dispatchRefunded(payload, db);

    expect(contractRefund.refundNowPaymentsContractOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      orderStatus: 'expired', wasCompleted: true,
    }));
    expect(subscriptionHandler.handleRefunded).not.toHaveBeenCalled();
  });

  // ─── Subscription Cases (5-8): Refunded ────────────────────────────────────

  it('case 5: BASIC tier refunded → subscription handler', async () => {
    const payload = buildIpnPayload({
      invoice_id: '5710519960',
      payment_status: 'refunded',
    })
    const config = {
      kind: 'subscription' as const,
      tier: 'BASIC' as const,
      config: {
        tier: 'BASIC' as const,
        invoiceId: '5710519960',
        yearlyInvoiceId: '5710519960',
        price: 199,
        yearlyPrice: 1990,
        currency: 'USD',
        name: 'Starter',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue({ ok: true, value: undefined })

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  it('case 6: PREMIUM tier refunded → subscription handler', async () => {
    const payload = buildIpnPayload({
      invoice_id: '4559269964',
      payment_status: 'refunded',
    })
    const config = {
      kind: 'subscription' as const,
      tier: 'PREMIUM' as const,
      config: {
        tier: 'PREMIUM' as const,
        invoiceId: '4559269964',
        yearlyInvoiceId: '4559269964',
        price: 399,
        yearlyPrice: 3990,
        currency: 'USD',
        name: 'Growth',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue({ ok: true, value: undefined })

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  it('case 7: ENTERPRISE tier refunded → subscription handler', async () => {
    const payload = buildIpnPayload({
      invoice_id: '6336799275',
      payment_status: 'refunded',
    })
    const config = {
      kind: 'subscription' as const,
      tier: 'ENTERPRISE' as const,
      config: {
        tier: 'ENTERPRISE' as const,
        invoiceId: '6336799275',
        yearlyInvoiceId: '6336799275',
        price: 799,
        yearlyPrice: 7990,
        currency: 'USD',
        name: 'Premium',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue({ ok: true, value: undefined })

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  it('case 8: MASTER tier refunded → subscription handler', async () => {
    const payload = buildIpnPayload({
      invoice_id: '5589879034',
      payment_status: 'refunded',
    })
    const config = {
      kind: 'subscription' as const,
      tier: 'MASTER' as const,
      config: {
        tier: 'MASTER' as const,
        invoiceId: '5589879034',
        yearlyInvoiceId: '5589879034',
        price: 4999,
        yearlyPrice: 0,
        currency: 'USD',
        name: 'Master',
      },
    }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue({ ok: true, value: undefined })

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  // ─── One-Time Case (10): Refunded ──────────────────────────────────────────

  it('case 10: STARTER_BUNDLE one_time refunded → one-time handler', async () => {
    const payload = buildIpnPayload({
      invoice_id: '7810429001',
      payment_status: 'refunded',
    })
    const sku: OneTimeSku = {
      id: 'STARTER_BUNDLE',
      invoiceId: '7810429001',
      priceUsd: 49,
      credits: 10,
      ttlMonths: 12,
      label_vi: 'Gói Khởi Đầu',
      label_en: 'Starter Bundle',
    }
    const config = { kind: 'one_time' as const, sku }
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(config)
    vi.mocked(oneTimeHandler.handleOneTimeRefunded).mockResolvedValue({ ok: true, value: undefined })

    await dispatchRefunded(payload)

    expect(oneTimeHandler.handleOneTimeRefunded).toHaveBeenCalledWith(payload)
    expect(subscriptionHandler.handleRefunded).not.toHaveBeenCalled()
  })

  it('refund with no invoice_id → fall through to subscription handler', async () => {
    const payload = buildIpnPayload({
      invoice_id: undefined,
      payment_status: 'refunded',
    })
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue({ ok: true, value: undefined })

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })

  it('refund with unknown invoice_id → still fall through to subscription handler', async () => {
    const payload = buildIpnPayload({
      invoice_id: 'unknown_9999999999',
      payment_status: 'refunded',
    })
    vi.mocked(nowpaymentsClient.lookupInvoice).mockReturnValue(null)
    vi.mocked(subscriptionHandler.handleRefunded).mockResolvedValue({ ok: true, value: undefined })

    await dispatchRefunded(payload)

    expect(subscriptionHandler.handleRefunded).toHaveBeenCalledWith(payload)
  })
})

describe('dispatchPaymentStatus — stale terminal status protection', () => {
  it('does not apply an expired status unless the persisted order is still pending', async () => {
    const statusFilter = vi.fn().mockResolvedValue({ error: null });
    const orderFilter = vi.fn().mockReturnValue({ eq: statusFilter });
    const db = {
      from: vi.fn(() => ({ update: vi.fn(() => ({ eq: orderFilter })) })),
    } as never;

    await dispatchPaymentStatus(db, buildIpnPayload({
      order_id: 'contract-order-1', payment_status: 'expired',
    }));

    expect(orderFilter).toHaveBeenCalledWith('order_id', 'contract-order-1');
    expect(statusFilter).toHaveBeenCalledWith('status', 'pending');
  });
});
