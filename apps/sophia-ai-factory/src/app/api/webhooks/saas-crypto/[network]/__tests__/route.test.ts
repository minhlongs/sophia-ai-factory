import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt-conv-1'] }),
  },
}));

import { inngest } from '@/seed/inngest/client';

describe('POST /api/webhooks/saas-crypto/[network]', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      PARTNERSTACK_WEBHOOK_SECRET: 'partnerstack_secret_123',
      BINANCE_AFFILIATE_WEBHOOK_SECRET: 'binance_secret_abc',
    };
  });

  it('returns 404 for unsupported network parameter', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/saas-crypto/unsupported_net', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req, { params: { network: 'unsupported_net' } });
    expect(res.status).toBe(404);
  });

  it('returns 200 skipped if secret is not configured in env', async () => {
    delete process.env.PARTNERSTACK_WEBHOOK_SECRET;

    const req = new NextRequest('http://localhost/api/webhooks/saas-crypto/partnerstack', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req, { params: { network: 'partnerstack' } });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; skipped: string };
    expect(data.skipped).toBe('secret_not_configured');
  });

  it('returns 401 if signature header is missing', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/saas-crypto/partnerstack', {
      method: 'POST',
      body: JSON.stringify({ reward_amount_cents: 100 }),
    });

    const res = await POST(req, { params: { network: 'partnerstack' } });
    expect(res.status).toBe(401);
  });

  it('returns 401 if signature is invalid', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/saas-crypto/partnerstack', {
      method: 'POST',
      headers: {
        'x-partnerstack-signature': 'wrong_signature_hash',
      },
      body: JSON.stringify({ reward_amount_cents: 100 }),
    });

    const res = await POST(req, { params: { network: 'partnerstack' } });
    expect(res.status).toBe(401);
  });

  it('processes valid PartnerStack postback and emits Inngest event', async () => {
    const rawPayload = JSON.stringify({
      id: 'txn_ps_001',
      partner_key: 'aff_saas_01',
      reward_amount_cents: 4500,
    });

    const req = new NextRequest('http://localhost/api/webhooks/saas-crypto/partnerstack', {
      method: 'POST',
      headers: {
        'x-partnerstack-signature': 'partnerstack_secret_123',
      },
      body: rawPayload,
    });

    const res = await POST(req, { params: { network: 'partnerstack' } });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; success: boolean; eventId: string; commissionCents: number };
    expect(data.success).toBe(true);
    expect(data.commissionCents).toBe(4500);
    expect(data.eventId).toBe('partnerstack_txn_ps_001');
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'conversion.created',
      }),
    );
  });

  it('processes valid Binance postback via authorization header', async () => {
    const rawPayload = JSON.stringify({
      tradeId: 'reb_binance_99',
      referralId: 'CRYPTO_VIP',
      rebateUsd: 15.5,
    });

    const req = new NextRequest('http://localhost/api/webhooks/saas-crypto/binance', {
      method: 'POST',
      headers: {
        authorization: 'Bearer binance_secret_abc',
      },
      body: rawPayload,
    });

    const res = await POST(req, { params: { network: 'binance' } });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; success: boolean; eventId: string; commissionCents: number };
    expect(data.success).toBe(true);
    expect(data.commissionCents).toBe(1550);
    expect(data.eventId).toBe('binance_reb_binance_99');
  });
});
