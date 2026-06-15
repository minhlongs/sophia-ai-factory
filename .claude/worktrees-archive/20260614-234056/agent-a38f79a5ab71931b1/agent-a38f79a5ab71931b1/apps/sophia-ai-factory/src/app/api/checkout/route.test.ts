/**
 * Tests for GET /api/checkout and POST /api/checkout
 *
 * Coverage:
 *   - GET: 4 tiers (BASIC, PREMIUM, ENTERPRISE, MASTER) redirect to NOWPayments when authed
 *   - GET: anonymous → redirect to /login?redirect=...
 *   - GET: invalid tier → redirect to /pricing
 *   - GET: tier alias mapping (STARTER→BASIC, GROWTH→PREMIUM)
 *   - POST: valid tier + authed → returns { url }
 *   - POST: unauthenticated → 401
 *   - POST: invalid tier → 400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks ---

vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));

vi.mock('@/seed/auth/better-auth-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/seed/auth/better-auth-session')>();
  return {
    ...actual,
    getCurrentUserFromHeaders: vi.fn(),
  };
});

vi.mock('@/tree/clients/nowpayments-client', () => ({
  NOWPAYMENTS_TIERS: {
    BASIC: { tier: 'BASIC', invoiceId: '111', price: 199, currency: 'USD', name: 'Starter' },
    PREMIUM: { tier: 'PREMIUM', invoiceId: '222', price: 399, currency: 'USD', name: 'Growth' },
    ENTERPRISE: { tier: 'ENTERPRISE', invoiceId: '333', price: 799, currency: 'USD', name: 'Premium' },
    MASTER: { tier: 'MASTER', invoiceId: '444', price: 4999, currency: 'USD', name: 'Master' },
  },
  createInvoiceUrl: vi.fn(
    (tier: string, userId: string) =>
      `https://nowpayments.io/payment?iid=TEST_${tier}&order_id=sophia_${userId}_123`
  ),
}));

vi.mock('@/land/orders/pending-order-repo', () => ({
  findActivePendingOrder: vi.fn(),
  writeOrder: vi.fn(async (input: any) => ({
    order_id: input.order_id,
    user_id: input.user_id,
    tier: input.tier,
    period: input.period,
    payment_method: input.payment_method,
    amount_usd_cents: input.amount_usd_cents,
    invoice_url: input.invoice_url,
    status: 'pending',
    created_at: new Date().toISOString(),
  })),
}));

import { AuthSystemError } from '@/seed/auth/better-auth-session';
import { GET, POST } from './route';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { createInvoiceUrl } from '@/tree/clients/nowpayments-client';
import { findActivePendingOrder } from '@/land/orders/pending-order-repo';

const mockGetUser = vi.mocked(getCurrentUserFromHeaders);
const mockCreateInvoiceUrl = vi.mocked(createInvoiceUrl);
const mockFindActivePendingOrder = vi.mocked(findActivePendingOrder);

const APP_URL = 'https://sophia.agencyos.network';

function makeGetRequest(tier?: string): NextRequest {
  const url = tier
    ? `http://localhost/api/checkout?tier=${tier}`
    : 'http://localhost/api/checkout';
  return new NextRequest(url, { method: 'GET' });
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = APP_URL;
  });

  it('BASIC tier + authed → redirect to NOWPayments invoice URL', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
    const res = await GET(makeGetRequest('BASIC'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toContain('nowpayments.io/payment');
    expect(mockCreateInvoiceUrl).toHaveBeenCalledWith('BASIC', 'user-1');
  });

  it('PREMIUM tier + authed → redirect to NOWPayments invoice URL', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-2', email: 'b@b.com' });
    const res = await GET(makeGetRequest('PREMIUM'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(mockCreateInvoiceUrl).toHaveBeenCalledWith('PREMIUM', 'user-2');
  });

  it('ENTERPRISE tier + authed → redirect to NOWPayments invoice URL', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-3', email: 'c@b.com' });
    const res = await GET(makeGetRequest('ENTERPRISE'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(mockCreateInvoiceUrl).toHaveBeenCalledWith('ENTERPRISE', 'user-3');
  });

  it('MASTER tier + authed → redirect to NOWPayments invoice URL', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-4', email: 'd@b.com' });
    const res = await GET(makeGetRequest('MASTER'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(mockCreateInvoiceUrl).toHaveBeenCalledWith('MASTER', 'user-4');
  });

  it('STARTER alias + authed → maps to BASIC and redirects', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-5', email: 'e@b.com' });
    const res = await GET(makeGetRequest('STARTER'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(mockCreateInvoiceUrl).toHaveBeenCalledWith('BASIC', 'user-5');
  });

  it('GROWTH alias + authed → maps to PREMIUM and redirects', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-6', email: 'f@b.com' });
    const res = await GET(makeGetRequest('GROWTH'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(mockCreateInvoiceUrl).toHaveBeenCalledWith('PREMIUM', 'user-6');
  });

  it('anonymous user → redirects to /login with redirect param', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest('BASIC'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/login');
    expect(location).toContain('redirect=');
    expect(mockCreateInvoiceUrl).not.toHaveBeenCalled();
  });

  it('invalid tier → redirects to /pricing', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-7', email: 'g@b.com' });
    const res = await GET(makeGetRequest('INVALID_TIER'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toContain('/pricing');
    expect(mockCreateInvoiceUrl).not.toHaveBeenCalled();
  });

  it('missing tier param → redirects to /pricing', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-8', email: 'h@b.com' });
    const res = await GET(makeGetRequest());
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toContain('/pricing');
  });
});

describe('POST /api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = APP_URL;
  });

  it('valid tier + authed → returns { url }', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-9', email: 'i@b.com' });
    mockCreateInvoiceUrl.mockReturnValue('https://nowpayments.io/payment?iid=111');
    const res = await POST(makePostRequest({ tier: 'BASIC' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string };
    expect(body.url).toContain('nowpayments.io');
  });

  it('valid tier + authed + existing pending order → returns existing pending order URL (deduped)', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-9', email: 'i@b.com' });
    mockFindActivePendingOrder.mockResolvedValue({
      order_id: 'sophia_user-9_existing',
      user_id: 'user-9',
      tier: 'BASIC',
      period: 'monthly',
      payment_method: 'nowpayments',
      amount_usd_cents: 19900,
      promo_code: null,
      customer_email: null,
      invoice_url: 'https://nowpayments.io/payment?iid=existing_111',
      status: 'pending',
      payment_id: null,
      created_at: new Date().toISOString(),
      completed_at: null,
    });

    const res = await POST(makePostRequest({ tier: 'BASIC' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; orderId: string; deduped: boolean };
    expect(body.url).toBe('https://nowpayments.io/payment?iid=existing_111');
    expect(body.orderId).toBe('sophia_user-9_existing');
    expect(body.deduped).toBe(true);
    expect(mockCreateInvoiceUrl).not.toHaveBeenCalled();
  });

  it('unauthenticated → 401 with error message', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(makePostRequest({ tier: 'PREMIUM' }));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/login/i);
  });

  it('AuthSystemError from getCurrentUserFromHeaders → POST returns 500 (system error, not 401)', async () => {
    mockGetUser.mockRejectedValueOnce(new AuthSystemError('D1 connection lost'));
    const res = await POST(makePostRequest({ tier: 'BASIC' }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/failed/i);
  });

  it('invalid tier → 400 with error', async () => {
    mockGetUser.mockResolvedValue({ id: 'user-10', email: 'j@b.com' });
    const res = await POST(makePostRequest({ tier: 'INVALID' }));
    expect(res.status).toBe(400);
  });
});
