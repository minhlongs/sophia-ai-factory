/**
 * Tests for POST /api/webhooks/tiktok-notification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const maybeSingleFn = vi.fn().mockResolvedValue({ data: null });
  const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });
  const db = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn }),
      }),
      update: updateFn,
    }),
    maybeSingleFn,
    updateFn,
  };
  return {
    db,
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
});

vi.mock('@/lib/utils/logger-utility', () => ({ logger: mocks.logger }));
vi.mock('@/lib/db/client', () => ({ getD1Client: vi.fn().mockResolvedValue(mocks.db) }));

import { POST } from './route';

async function makeHmacSignature(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  const bodyStr = JSON.stringify(body);
  return new Request('http://localhost/api/webhooks/tiktok-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: bodyStr,
  });
}

describe('POST /api/webhooks/tiktok-notification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TIKTOK_WEBHOOK_SECRET;
    mocks.db.maybeSingleFn.mockResolvedValue({ data: null });
  });

  it('returns 401 for invalid HMAC signature', async () => {
    process.env.TIKTOK_WEBHOOK_SECRET = 'supersecret';
    const res = await POST(makeRequest(
      { data: { publish_id: 'p1' } },
      { 'x-tiktok-signature': 'badhex' },
    ));
    expect(res.status).toBe(401);
    delete process.env.TIKTOK_WEBHOOK_SECRET;
  });

  it('returns 200 when no result found for publishId', async () => {
    const res = await POST(makeRequest({ data: { publish_id: 'pk_unknown' } }));
    expect(res.status).toBe(200);
  });

  it('returns 200 for valid HMAC signature', async () => {
    const secret = 'tiktok_secret_123';
    process.env.TIKTOK_WEBHOOK_SECRET = secret;
    const bodyObj = { data: { publish_id: 'pk_signed' } };
    const bodyStr = JSON.stringify(bodyObj);
    const sig = await makeHmacSignature(bodyStr, secret);

    const req = new Request('http://localhost/api/webhooks/tiktok-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tiktok-signature': sig },
      body: bodyStr,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    delete process.env.TIKTOK_WEBHOOK_SECRET;
  });

  it('updates metrics_json when result found', async () => {
    mocks.db.maybeSingleFn.mockResolvedValueOnce({
      data: { id: 42, metrics_json: JSON.stringify({ views: 100 }) },
    });

    const res = await POST(makeRequest({
      event: 'video_engagement',
      data: {
        publish_id: 'pk_found',
        statistics: { play_count: 500, like_count: 20, comment_count: 5, share_count: 3 },
      },
    }));
    expect(res.status).toBe(200);
  });

  it('returns 200 with ok=true for missing publishId', async () => {
    const res = await POST(makeRequest({ event: 'ping' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
