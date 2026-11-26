/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetCurrentUser = vi.fn();
const mockLookupUserApiKey = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  lookupUserApiKey: (...args: unknown[]) => mockLookupUserApiKey(...args),
}));

import { POST } from '../route';

describe('POST /api/first-value/voice (OpenRouter 1-Key BYOK TTS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns 401 when unauthenticated and 400 on invalid payload', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const unauth = await POST(
      new NextRequest('http://localhost/api/first-value/voice', {
        method: 'POST',
        body: JSON.stringify({ text: 'Xin chào anh chị' }),
      }),
    );
    expect(unauth.status).toBe(401);

    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'pilot@example.com' });
    const badJson = await POST(
      new NextRequest('http://localhost/api/first-value/voice', {
        method: 'POST',
        body: 'not-json',
      }),
    );
    expect(badJson.status).toBe(400);

    const shortText = await POST(
      new NextRequest('http://localhost/api/first-value/voice', {
        method: 'POST',
        body: JSON.stringify({ text: 'hi' }),
      }),
    );
    expect(shortText.status).toBe(400);
  });

  it('returns 422 when customer OpenRouter BYOK key is missing', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'pilot@example.com' });
    mockLookupUserApiKey.mockResolvedValue(null);

    const res = await POST(
      new NextRequest('http://localhost/api/first-value/voice', {
        method: 'POST',
        body: JSON.stringify({ text: 'Đây là kịch bản review SaaS cho team nhỏ.' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('synthesizes real mp3 audio via OpenRouter BYOK TTS and surfaces upstream errors honestly', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'pilot@example.com' });
    mockLookupUserApiKey.mockResolvedValue({ status: 'FOUND', key: 'sk-or-v1-test-key' });

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new Uint8Array([0x49, 0x44, 0x33, 0x03]).buffer),
    });
    vi.stubGlobal('fetch', mockFetch);

    const okRes = await POST(
      new NextRequest('http://localhost/api/first-value/voice', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Đây là kịch bản review SaaS siêu mượt cho anh chị em.',
          locale: 'vi',
          voice: 'vi-VN-HoaiMyNeural',
          filename: 'camp_123',
        }),
      }),
    );
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(okRes.headers.get('Content-Disposition')).toContain('camp_123.mp3');
    expect(okRes.headers.get('X-Sophia-Tts-Provider')).toBe('openrouter-byok');

    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    const errRes = await POST(
      new NextRequest('http://localhost/api/first-value/voice', {
        method: 'POST',
        body: JSON.stringify({ text: 'Kịch bản kiểm tra lỗi upstream 503.' }),
      }),
    );
    expect(errRes.status).toBe(502);
  });
});
