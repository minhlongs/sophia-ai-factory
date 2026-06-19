/**
 * M1 — Malformed JSON regression tests
 * Verifies /api/promo/validate and /api/promo/redeem-free return 400 (not 500) on bad JSON.
 * @module tests/security/m1-malformed-json
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';

// ---- Shared mocks ----

vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (req: Request) => Promise<Response>) => handler,
}));

vi.mock('@/land/promo/promo-validator', () => ({
  validatePromoCode: vi.fn().mockResolvedValue({
    valid: true,
    code: 'VALID10',
    codeId: 'code_test',
    discountType: 'percentage',
    discountValue: 10,
    appliesToTier: null,
    appliesToSku: null,
    description: null,
  }),
}));

vi.mock('@/land/promo/promo-applier', () => ({
  applyPromoCode: vi.fn().mockResolvedValue({
    redemptionId: 'red_test',
    magicLink: null,
    handoverId: null,
    trialDaysGranted: null,
  }),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/seed/auth/better-auth-server', () => ({
  getAuth: vi.fn().mockReturnValue(null),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
  getD1: vi.fn(() => ({
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
      }),
    }),
  })),
}));

vi.mock('@/tree/handover/handover-account-setup', () => ({
  createCustomerUser: vi.fn().mockResolvedValue('user_test'),
}));

vi.mock('@/tree/email/sender', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/tree/telegram/telegram-handover-notifier', () => ({
  sendHandoverTelegramDm: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---- Helpers ----

// CF Workers redefines the global Request; cast to NextRequest satisfies route handler signatures in test context
function makeRawRequest(url: string, rawBody: string): NextRequest {
  return new Request(new URL(url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody || null,
  }) as unknown as NextRequest;
}

// ---- /api/promo/validate ----

describe('M1 — /api/promo/validate malformed JSON', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 with error:invalid_json on malformed body', async () => {
    const { POST } = await import('@/app/api/promo/validate/route');
    const req = makeRawRequest('http://localhost:3000/api/promo/validate', '{not json');
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('invalid_json');
  });

  it('returns 400 with error:invalid_json on empty body', async () => {
    const { POST } = await import('@/app/api/promo/validate/route');
    const req = makeRawRequest('http://localhost:3000/api/promo/validate', '');
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('invalid_json');
  });

  it('returns 200 on valid JSON body', async () => {
    const { POST } = await import('@/app/api/promo/validate/route');
    const req = makeRawRequest(
      'http://localhost:3000/api/promo/validate',
      JSON.stringify({ code: 'VALID10' }),
    );
    const res = await POST(req);
    // validatePromoCode mock returns valid:true — expect 200 from handler
    expect(res.status).toBe(200);
  });
});

// ---- /api/promo/redeem-free ----

describe('M1 — /api/promo/redeem-free malformed JSON', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 with error:invalid_json on malformed body', async () => {
    const { POST } = await import('@/app/api/promo/redeem-free/route');
    const req = makeRawRequest('http://localhost:3000/api/promo/redeem-free', '{not json');
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('invalid_json');
  });

  it('returns 400 with error:invalid_json on empty body', async () => {
    const { POST } = await import('@/app/api/promo/redeem-free/route');
    const req = makeRawRequest('http://localhost:3000/api/promo/redeem-free', '');
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('invalid_json');
  });
});
