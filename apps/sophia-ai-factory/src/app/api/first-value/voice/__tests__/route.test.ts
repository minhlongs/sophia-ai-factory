/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PILOT_POLICY_VERSION } from '@/seed/pilot/pilot-access-policy';

const mockGetCurrentUser = vi.fn();
const mockLookupUserApiKey = vi.fn();
const mockVerifyCsrfToken = vi.fn();
const mockVerifyWorkspaceAccess = vi.fn();
const mockGetD1 = vi.fn();
const mockGetPilotConsent = vi.fn();
const mockReserveSlot = vi.fn();
const mockClearLock = vi.fn();
const mockReleaseSlot = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  verifyWorkspaceAccess: (...args: unknown[]) => mockVerifyWorkspaceAccess(...args),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: () => mockGetD1(),
}));

vi.mock('@/seed/security/csrf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/seed/security/csrf')>();
  return {
    ...actual,
    verifyCsrfToken: (req: NextRequest) => mockVerifyCsrfToken(req),
  };
});

vi.mock('@/tree/byok/user-api-key-store', () => ({
  lookupUserApiKey: (...args: unknown[]) => mockLookupUserApiKey(...args),
}));

vi.mock('@/tree/first-value/pilot-state-repo', () => ({
  getPilotConsent: (...args: unknown[]) => mockGetPilotConsent(...args),
  reservePilotGenerationSlot: (...args: unknown[]) => mockReserveSlot(...args),
  clearPilotInFlightLock: (...args: unknown[]) => mockClearLock(...args),
  releasePilotGenerationSlot: (...args: unknown[]) => mockReleaseSlot(...args),
}));

import { POST } from '../route';

describe('POST /api/first-value/voice (OpenRouter 1-Key BYOK TTS)', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.PILOT_LIVE_INFERENCE_ENABLED = 'true';
    process.env.PILOT_FINANCING_MODE = 'CUSTOMER_BYOK';
    process.env.PILOT_MAX_GENERATIONS = '5';
    process.env.PILOT_MAX_ESTIMATED_SPEND_USD = '1.00';
    process.env.PILOT_ESTIMATED_COST_PER_ATTEMPT_USD = '0.01';
    mockVerifyCsrfToken.mockReturnValue(true);
    mockVerifyWorkspaceAccess.mockResolvedValue(true);
    mockGetD1.mockResolvedValue({});
    mockGetPilotConsent.mockResolvedValue({ policyVersion: PILOT_POLICY_VERSION });
    mockReserveSlot.mockResolvedValue({ outcome: 'reserved', lockUntilMs: Date.now() + 60_000 });
    mockClearLock.mockResolvedValue(undefined);
    mockReleaseSlot.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('returns 401 when unauthenticated and 400 on invalid payload', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const unauth = await POST(
      new NextRequest('http://localhost/api/first-value/voice', {
        method: 'POST',
        body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào anh chị' }),
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
        body: JSON.stringify({ orgId: 'org-1', text: 'hi' }),
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
        body: JSON.stringify({ orgId: 'org-1', text: 'Đây là kịch bản review SaaS cho team nhỏ.' }),
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
          orgId: 'org-1',
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
    expect(okRes.headers.get('X-Sophia-Tts-Model')).toBe('microsoft/mai-voice-2.1-flash');

    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    const errRes = await POST(
      new NextRequest('http://localhost/api/first-value/voice', {
        method: 'POST',
        body: JSON.stringify({ orgId: 'org-1', text: 'Kịch bản kiểm tra lỗi upstream 503.' }),
      }),
    );
    expect(errRes.status).toBe(502);
  });
});
