import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrepare = vi.fn();
const mockGetD1Raw = vi.fn();

vi.mock('@/seed/db/client', () => ({
  getD1Raw: () => mockGetD1Raw(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

async function computeHmacHex(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function makeRequest(body: string, sig?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (sig !== undefined) headers['x-grab-signature'] = sig;
  return new NextRequest('https://sophia.agencyos.network/api/webhooks/grabpay', {
    method: 'POST',
    headers,
    body,
  });
}

describe('POST /api/webhooks/grabpay', () => {
  const SECRET = 'test-grabpay-secret-123';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GRABPAY_WEBHOOK_SECRET = SECRET;
  });

  it('returns 503 when GRABPAY_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.GRABPAY_WEBHOOK_SECRET;
    const { POST } = await import('../route');
    const res = await POST(makeRequest('{}', 'sig'));
    expect(res.status).toBe(503);
  });

  it('returns 401 when signature header is missing or invalid', async () => {
    const { POST } = await import('../route');
    const body = JSON.stringify({ transactionId: 'tx_1', status: 'SUCCESS', amount: 100, currency: 'SGD' });
    expect((await POST(makeRequest(body))).status).toBe(401);
    expect((await POST(makeRequest(body, 'deadbeef'))).status).toBe(401);
  });

  it('returns 400 on malformed JSON and 422 on missing transactionId', async () => {
    const { POST } = await import('../route');
    const badJson = '{invalid';
    const badSig = await computeHmacHex(badJson, SECRET);
    expect((await POST(makeRequest(badJson, badSig))).status).toBe(400);

    const noTxn = JSON.stringify({ status: 'SUCCESS', amount: 100, currency: 'SGD' });
    const noTxnSig = await computeHmacHex(noTxn, SECRET);
    expect((await POST(makeRequest(noTxn, noTxnSig))).status).toBe(422);
  });

  it('returns 503 when database is unavailable', async () => {
    mockGetD1Raw.mockResolvedValueOnce(null);
    const { POST } = await import('../route');
    const body = JSON.stringify({ transactionId: 'tx_1', status: 'SUCCESS', amount: 100, currency: 'SGD' });
    const sig = await computeHmacHex(body, SECRET);
    expect((await POST(makeRequest(body, sig))).status).toBe(503);
  });

  it('handles duplicate processed (200) and in-progress (409) events', async () => {
    const { POST } = await import('../route');
    const body = JSON.stringify({ transactionId: 'tx_dup', status: 'SUCCESS', amount: 100, currency: 'SGD' });
    const sig = await computeHmacHex(body, SECRET);

    mockPrepare
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 0 } }) }) })
      .mockReturnValueOnce({ bind: () => ({ first: async () => ({ processed: 1 }) }) });
    mockGetD1Raw.mockResolvedValueOnce({ prepare: mockPrepare });
    const dupRes = await POST(makeRequest(body, sig));
    expect(dupRes.status).toBe(200);
    expect(await dupRes.json()).toMatchObject({ received: true, duplicate: true });

    mockPrepare
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 0 } }) }) })
      .mockReturnValueOnce({ bind: () => ({ first: async () => ({ processed: 0 }) }) });
    mockGetD1Raw.mockResolvedValueOnce({ prepare: mockPrepare });
    const inflightRes = await POST(makeRequest(body, sig));
    expect(inflightRes.status).toBe(409);
  });

  it('returns 404 when transaction is missing and 200 duplicate when non-pending', async () => {
    const { POST } = await import('../route');
    const body = JSON.stringify({ transactionId: 'tx_404', status: 'SUCCESS', amount: 100, currency: 'SGD' });
    const sig = await computeHmacHex(body, SECRET);

    mockPrepare
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) })
      .mockReturnValueOnce({ bind: () => ({ first: async () => null }) })
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) });
    mockGetD1Raw.mockResolvedValueOnce({ prepare: mockPrepare });
    expect((await POST(makeRequest(body, sig))).status).toBe(404);

    mockPrepare
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) })
      .mockReturnValueOnce({
        bind: () => ({
          first: async () => ({ id: 'tx_404', total_amount: 100, settlement_currency: 'SGD', status: 'completed' }),
        }),
      })
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) });
    mockGetD1Raw.mockResolvedValueOnce({ prepare: mockPrepare });
    const nonPending = await POST(makeRequest(body, sig));
    expect(nonPending.status).toBe(200);
    expect(await nonPending.json()).toMatchObject({ received: true, duplicate: true, status: 'completed' });
  });

  it('handles SUCCESS settlement, amount mismatch, duplicate update, EXPIRED, and FAILED', async () => {
    const { POST } = await import('../route');
    const txn = { id: 'tx_ok', total_amount: 100, settlement_currency: 'SGD', status: 'pending' };

    // Valid SUCCESS
    const okBody = JSON.stringify({ transactionId: 'tx_ok', status: 'SUCCESS', amount: 100, currency: 'SGD', grabSessionId: 'gs_1' });
    const okSig = await computeHmacHex(okBody, SECRET);
    mockPrepare
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) })
      .mockReturnValueOnce({ bind: () => ({ first: async () => txn }) })
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) })
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) });
    mockGetD1Raw.mockResolvedValueOnce({ prepare: mockPrepare });
    const okRes = await POST(makeRequest(okBody, okSig));
    expect(okRes.status).toBe(200);
    expect(await okRes.json()).toMatchObject({ received: true, status: 'completed' });

    // SUCCESS with 0 changes -> duplicate
    mockPrepare
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) })
      .mockReturnValueOnce({ bind: () => ({ first: async () => txn }) })
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 0 } }) }) })
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) });
    mockGetD1Raw.mockResolvedValueOnce({ prepare: mockPrepare });
    const dupUpd = await POST(makeRequest(okBody, okSig));
    expect(dupUpd.status).toBe(200);
    expect(await dupUpd.json()).toMatchObject({ received: true, duplicate: true });

    // Amount/currency mismatch -> 422
    const badAmtBody = JSON.stringify({ transactionId: 'tx_ok', status: 'SUCCESS', amount: 1, currency: 'USD' });
    const badAmtSig = await computeHmacHex(badAmtBody, SECRET);
    mockPrepare
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) })
      .mockReturnValueOnce({ bind: () => ({ first: async () => txn }) })
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) })
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) });
    mockGetD1Raw.mockResolvedValueOnce({ prepare: mockPrepare });
    expect((await POST(makeRequest(badAmtBody, badAmtSig))).status).toBe(422);

    // EXPIRED -> 200 expired
    const expBody = JSON.stringify({ transactionId: 'tx_ok', status: 'EXPIRED', amount: 100, currency: 'SGD' });
    const expSig = await computeHmacHex(expBody, SECRET);
    mockPrepare
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) })
      .mockReturnValueOnce({ bind: () => ({ first: async () => txn }) })
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) })
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) });
    mockGetD1Raw.mockResolvedValueOnce({ prepare: mockPrepare });
    const expRes = await POST(makeRequest(expBody, expSig));
    expect(expRes.status).toBe(200);
    expect(await expRes.json()).toMatchObject({ received: true, status: 'expired' });

    // FAILED -> 200 failed
    const failBody = JSON.stringify({ transactionId: 'tx_ok', status: 'FAILED', amount: 100, currency: 'SGD' });
    const failSig = await computeHmacHex(failBody, SECRET);
    mockPrepare
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) })
      .mockReturnValueOnce({ bind: () => ({ first: async () => txn }) })
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) })
      .mockReturnValueOnce({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) });
    mockGetD1Raw.mockResolvedValueOnce({ prepare: mockPrepare });
    const failRes = await POST(makeRequest(failBody, failSig));
    expect(failRes.status).toBe(200);
    expect(await failRes.json()).toMatchObject({ received: true, status: 'failed' });
  });
});
