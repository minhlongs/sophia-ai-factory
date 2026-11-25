/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetCurrentUser = vi.fn();
const mockSynthesizeEdgeTts = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/forest/edge-tts', () => ({
  synthesizeEdgeTts: (...args: unknown[]) => mockSynthesizeEdgeTts(...args),
}));

import { POST } from '../route';

describe('POST /api/first-value/voice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ text: 'Xin chào anh chị' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid JSON or short text', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'pilot@example.com' });
    const badJsonReq = new NextRequest('http://localhost/api/first-value/voice', {
      method: 'POST',
      body: 'not-json',
    });
    expect((await POST(badJsonReq)).status).toBe(400);

    const shortReq = new NextRequest('http://localhost/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ text: 'hi' }),
    });
    expect((await POST(shortReq)).status).toBe(400);
  });

  it('synthesizes Vietnamese Edge TTS audio and returns mp3 attachment', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'pilot@example.com' });
    mockSynthesizeEdgeTts.mockResolvedValue({
      audioBuffer: new Uint8Array([0x49, 0x44, 0x33, 0x03]),
      mimeType: 'audio/mpeg',
      durationSec: 12,
      voice: 'vi-VN-HoaiMyNeural',
      rate: '+0%',
      wordCount: 15,
    });

    const req = new NextRequest('http://localhost/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({
        text: 'Đây là kịch bản review sản phẩm siêu hot cho anh chị em.',
        locale: 'vi',
        gender: 'female',
        voice: 'vi-VN-HoaiMyNeural',
        filename: 'camp_123',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(res.headers.get('Content-Disposition')).toContain('camp_123.mp3');
    expect(res.headers.get('X-Sophia-Voice')).toBe('vi-VN-HoaiMyNeural');
    expect(mockSynthesizeEdgeTts).toHaveBeenCalledWith(
      'Đây là kịch bản review sản phẩm siêu hot cho anh chị em.',
      'vi',
      { gender: 'female', voice: 'vi-VN-HoaiMyNeural' },
    );
  });
});
