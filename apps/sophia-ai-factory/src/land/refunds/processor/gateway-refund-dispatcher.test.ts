import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callNowPaymentsRefund } from './gateway-refund-dispatcher';
import { processRefund } from './refund-processor';

const state = {
  status: 'approved',
  tierUpdates: 0,
  ledgerWrites: 0,
};

vi.mock('@/seed/db/client', () => ({
  getD1: async () => ({
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        run: async () => {
          const normalized = sql.toLowerCase();
          if (normalized.includes('insert into refund_events')) return { meta: { changes: 1 } };
          if (normalized.includes('delete from refund_events')) return { meta: { changes: 1 } };
          if (normalized.includes('update subscriptions') || normalized.includes('update organizations')) {
            state.tierUpdates += 1;
          }
          if (normalized.includes('insert into refund_ledger')) state.ledgerWrites += 1;
          if (normalized.includes('update refund_requests') && normalized.includes("status = 'refunded'")) {
            state.status = 'refunded';
          }
          return { meta: { changes: 1 } };
        },
        first: async () => {
          if (sql.toLowerCase().includes('select * from refund_requests')) {
            return {
              id: 'refund_001',
              user_id: 'user_001',
              purchase_id: 'purchase_001',
              payment_id: 'payment_001',
              amount_cents: 19900,
              customer_wallet_address: null,
              status: state.status,
            };
          }
          if (sql.toLowerCase().includes('select org_id from org_members')) return null;
          return null;
        },
      }),
    }),
  }),
}));

describe('NOWPayments refund credential guard', () => {
  beforeEach(() => {
    delete process.env.NOWPAYMENTS_API_KEY;
    state.status = 'approved';
    state.tierUpdates = 0;
    state.ledgerWrites = 0;
    vi.stubGlobal('fetch', vi.fn());
  });

  it.each([undefined, '', ' \t\n '])('rejects missing or blank credentials (%s)', async (credential) => {
    if (credential !== undefined) process.env.NOWPAYMENTS_API_KEY = credential;
    const fetchMock = vi.mocked(fetch);

    await expect(callNowPaymentsRefund('payment_001', null)).rejects.toMatchObject({
      name: 'RefundProcessError',
      code: 'NOWPAYMENTS_API_ERROR',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps processRefund from mutating internal refund state without credentials', async () => {
    const fetchMock = vi.mocked(fetch);
    const result = await processRefund({
      refundRequestId: 'refund_001',
      reviewedByUserId: 'admin_001',
      txHash: 'synthetic-tx-hash',
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'NOWPAYMENTS_API_ERROR' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state).toEqual({ status: 'approved', tierUpdates: 0, ledgerWrites: 0 });
  });
});
