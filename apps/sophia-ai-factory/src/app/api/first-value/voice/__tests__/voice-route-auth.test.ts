import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PILOT_POLICY_VERSION } from '@/seed/pilot/pilot-access-policy';

const mockGetCurrentUser = vi.fn();
const mockVerifyCsrfToken = vi.fn();
const mockVerifyWorkspaceAccess = vi.fn();
const mockGetD1 = vi.fn();
const mockLookupUserApiKey = vi.fn();
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

describe('Wave C.4 Lane B: /api/first-value/voice durable auth, workspace, consent, BYOK & D1 quota', () => {
  const originalFetch = globalThis.fetch;
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PILOT_LIVE_INFERENCE_ENABLED = 'true';
    process.env.PILOT_FINANCING_MODE = 'CUSTOMER_BYOK';
    process.env.PILOT_MAX_GENERATIONS = '5';
    process.env.PILOT_MAX_ESTIMATED_SPEND_USD = '1.00';
    process.env.PILOT_ESTIMATED_COST_PER_ATTEMPT_USD = '0.01';
    mockGetD1.mockResolvedValue({});
    mockClearLock.mockResolvedValue(undefined);
    mockReleaseSlot.mockResolvedValue(undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...origEnv };
  });

  it('rejects unauthenticated (401), invalid CSRF (403), cross-workspace (403), and missing consent (403)', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const r1 = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory' }),
    }));
    expect(r1.status).toBe(401);

    mockGetCurrentUser.mockResolvedValue({ id: 'u-voice-1', email: 'v@example.test' });
    mockVerifyCsrfToken.mockReturnValueOnce(false);
    const r2 = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory' }),
    }));
    expect(r2.status).toBe(403);

    mockVerifyCsrfToken.mockReturnValue(true);
    mockVerifyWorkspaceAccess.mockResolvedValueOnce(false);
    const r3 = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-other', text: 'Xin chào Sophia AI Factory' }),
    }));
    expect(r3.status).toBe(403);

    mockVerifyWorkspaceAccess.mockResolvedValue(true);
    mockGetPilotConsent.mockResolvedValueOnce(null);
    const r4 = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory' }),
    }));
    expect(r4.status).toBe(403);
  });

  it('enforces BYOK key (422), durable D1 concurrency/quota (429), and truthful OpenRouter headers (200)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u-voice-2', email: 'v@example.test' });
    mockVerifyCsrfToken.mockReturnValue(true);
    mockVerifyWorkspaceAccess.mockResolvedValue(true);
    mockGetPilotConsent.mockResolvedValue({ policyVersion: PILOT_POLICY_VERSION });

    mockLookupUserApiKey.mockResolvedValueOnce({ status: 'NOT_FOUND' });
    const rNoKey = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory' }),
    }));
    expect(rNoKey.status).toBe(422);

    mockLookupUserApiKey.mockResolvedValue({ status: 'FOUND', key: 'sk-or-v1-test-key-123456' });
    mockReserveSlot.mockResolvedValueOnce({ outcome: 'in_flight' });
    const rInFlight = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory', voice: 'nova' }),
    }));
    expect(rInFlight.status).toBe(429);

    mockReserveSlot.mockResolvedValueOnce({ outcome: 'reserved', lockUntilMs: Date.now() + 60_000 });
    const capturedBodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedBodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      return new Response(new Uint8Array([0x49, 0x44, 0x33, 0x03]), { status: 200 });
    }) as unknown as typeof fetch;

    const rOk = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory', voice: 'vi-VN-Harper:MAI-Voice-2.1-Flash' }),
    }));
    expect(rOk.status).toBe(200);
    expect(capturedBodies[0]?.model).toBe('microsoft/mai-voice-2.1-flash');
    expect(capturedBodies[0]?.voice).toBe('vi-VN-Harper:MAI-Voice-2.1-Flash');
    expect(capturedBodies[0]?.response_format).toBe('mp3');
    expect(rOk.headers.get('X-Sophia-Tts-Provider')).toBe('openrouter-byok');
    expect(rOk.headers.get('X-Sophia-Tts-Model')).toBe('microsoft/mai-voice-2.1-flash');
    expect(rOk.headers.get('X-Sophia-Tts-Funding')).toBe('customer_byok');
    expect(rOk.headers.get('X-Sophia-Tts-Cost-Status')).toBe('COST_ESTIMATE_AVAILABLE');
    expect(rOk.headers.get('X-Sophia-Tts-Estimated-Cost-Usd')).toBe('0.000390');
    expect(rOk.headers.get('X-Sophia-Tts-Billable-Chars')).toBe('26');
    expect(rOk.headers.get('X-Sophia-Voice')).toBe('vi-VN-Harper:MAI-Voice-2.1-Flash');
    expect(mockClearLock).toHaveBeenCalledTimes(1);

    // Default English female voice without explicit voice ID
    mockReserveSlot.mockResolvedValueOnce({ outcome: 'reserved', lockUntilMs: Date.now() + 60_000 });
    const rEn = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Hello Sophia AI Factory', locale: 'en', gender: 'female' }),
    }));
    expect(rEn.status).toBe(200);
    expect(rEn.headers.get('X-Sophia-Voice')).toBe('en-US-Harper:MAI-Voice-2.1-Flash');

    // Invalid schema -> 400
    const rBadSchema = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: '', text: 'a' }),
    }));
    expect(rBadSchema.status).toBe(400);

    // Default English male & Vietnamese male voices
    mockReserveSlot.mockResolvedValueOnce({ outcome: 'reserved', lockUntilMs: Date.now() + 60_000 });
    const rEnMale = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Hello Sophia AI Factory', locale: 'en', gender: 'male' }),
    }));
    expect(rEnMale.status).toBe(200);
    expect(rEnMale.headers.get('X-Sophia-Voice')).toBe('en-US-Grant:MAI-Voice-2.1-Flash');

    mockReserveSlot.mockResolvedValueOnce({ outcome: 'reserved', lockUntilMs: Date.now() + 60_000 });
    const rViMale = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory', locale: 'vi', gender: 'male' }),
    }));
    expect(rViMale.status).toBe(200);
    expect(rViMale.headers.get('X-Sophia-Voice')).toBe('vi-VN-Grant:MAI-Voice-2.1-Flash');
  });

  it('handles kill-switch, cost controls, financing disabled, storage unavailable, and upstream failure branches', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u-voice-3', email: 'v@example.test' });
    mockVerifyCsrfToken.mockReturnValue(true);
    mockVerifyWorkspaceAccess.mockResolvedValue(true);
    mockGetPilotConsent.mockResolvedValue({ policyVersion: PILOT_POLICY_VERSION });
    mockLookupUserApiKey.mockResolvedValue({ status: 'FOUND', key: 'sk-or-v1-test-key-123456' });
    mockReserveSlot.mockResolvedValue({ outcome: 'reserved', lockUntilMs: Date.now() + 60_000 });

    process.env.PILOT_LIVE_INFERENCE_ENABLED = 'false';
    const rDisabled = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory' }),
    }));
    expect(rDisabled.status).toBe(403);

    process.env.PILOT_LIVE_INFERENCE_ENABLED = 'true';
    delete process.env.PILOT_MAX_GENERATIONS;
    const rNoCost = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory' }),
    }));
    expect(rNoCost.status).toBe(503);

    process.env.PILOT_MAX_GENERATIONS = '5';
    process.env.PILOT_FINANCING_MODE = 'DISABLED';
    const rFinDisabled = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory' }),
    }));
    expect(rFinDisabled.status).toBe(503);

    process.env.PILOT_FINANCING_MODE = 'CUSTOMER_BYOK';
    mockGetD1.mockResolvedValueOnce(null);
    const rNoD1 = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory' }),
    }));
    expect(rNoD1.status).toBe(503);

    // Upstream 401 -> refunds slot and returns 422
    globalThis.fetch = vi.fn(async () => new Response('unauthorized', { status: 401 })) as unknown as typeof fetch;
    const r401 = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory' }),
    }));
    expect(r401.status).toBe(422);
    expect(mockReleaseSlot).toHaveBeenCalledTimes(1);

    // Upstream 500 -> clears lock only (no refund) and returns 502
    globalThis.fetch = vi.fn(async () => new Response('err', { status: 500 })) as unknown as typeof fetch;
    const r500 = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory' }),
    }));
    expect(r500.status).toBe(502);

    // Upstream network error -> clears lock only and returns 502
    globalThis.fetch = vi.fn(async () => { throw new Error('network'); }) as unknown as typeof fetch;
    const rNet = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory' }),
    }));
    expect(rNet.status).toBe(502);

    // Empty audio -> 502
    globalThis.fetch = vi.fn(async () => new Response(new Uint8Array(0), { status: 200 })) as unknown as typeof fetch;
    const rEmpty = await POST(new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org-1', text: 'Xin chào Sophia AI Factory' }),
    }));
    expect(rEmpty.status).toBe(502);
  });
});
