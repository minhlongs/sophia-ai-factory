/**
 * Route tests for POST /api/webhooks/affiliate/[network] (Sophia referral ledger).
 *
 * Pins the fail-LOUD contract: when the route cannot verify or persist a
 * conversion (secret missing, D1 missing, signature missing/invalid) it must
 * answer with an error status the provider will retry — never a 200 that
 * silently drops the conversion.
 *
 * @module app/api/webhooks/affiliate/[network]/__tests__/route.test
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/tree/affiliate/webhook-processor', () => ({
  processAffiliateWebhook: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: ['evt-1'] }) },
}));

import { getD1 } from '@/seed/db/client';
import { processAffiliateWebhook } from '@/tree/affiliate/webhook-processor';

describe('POST /api/webhooks/affiliate/[network]', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CLICKBANK_INS_SECRET: 'test_clickbank_secret' };
  });

  it('returns 404 for unsupported network parameter', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/affiliate/nope', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req, { params: { network: 'nope' } });
    expect(res.status).toBe(404);
  });

  it('returns 503 (not a silent 200) when the network secret is not configured', async () => {
    delete process.env.CLICKBANK_INS_SECRET;

    const req = new NextRequest('http://localhost/api/webhooks/affiliate/clickbank', {
      method: 'POST',
      headers: { 'x-clickbank-signature': 'anything' },
      body: JSON.stringify({}),
    });

    const res = await POST(req, { params: { network: 'clickbank' } });
    expect(res.status).toBe(503);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe('secret_not_configured');
    expect(processAffiliateWebhook).not.toHaveBeenCalled();
  });

  it('returns 503 (not a silent 200) when D1 is unavailable', async () => {
    vi.mocked(getD1).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/webhooks/affiliate/clickbank', {
      method: 'POST',
      headers: { 'x-clickbank-signature': 'anything' },
      body: JSON.stringify({}),
    });

    const res = await POST(req, { params: { network: 'clickbank' } });
    expect(res.status).toBe(503);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe('db_unavailable');
    expect(processAffiliateWebhook).not.toHaveBeenCalled();
  });

  it('returns 401 when the signature header is missing', async () => {
    vi.mocked(getD1).mockResolvedValue({} as unknown as D1Database);

    const req = new NextRequest('http://localhost/api/webhooks/affiliate/clickbank', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req, { params: { network: 'clickbank' } });
    expect(res.status).toBe(401);
    expect(processAffiliateWebhook).not.toHaveBeenCalled();
  });

  it('returns 401 when the processor reports an invalid HMAC', async () => {
    vi.mocked(getD1).mockResolvedValue({} as unknown as D1Database);
    vi.mocked(processAffiliateWebhook).mockResolvedValue({ success: false, error: 'INVALID_HMAC_SIGNATURE' });

    const req = new NextRequest('http://localhost/api/webhooks/affiliate/clickbank', {
      method: 'POST',
      headers: { 'x-clickbank-signature': 'wrong' },
      body: JSON.stringify({ receipt: 'X' }),
    });

    const res = await POST(req, { params: { network: 'clickbank' } });
    expect(res.status).toBe(401);
  });
});
