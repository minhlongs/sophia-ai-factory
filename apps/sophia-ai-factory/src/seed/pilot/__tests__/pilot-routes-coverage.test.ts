// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockGetAuth = vi.fn();
const mockToNextJsHandler = vi.fn();
const mockGetD1 = vi.fn();
const mockGetCurrentUserFromHeaders = vi.fn();
const mockLookupUserApiKey = vi.fn();
const mockSetUserApiKey = vi.fn();
const mockClearUserApiKey = vi.fn();
const mockProbeProviderKey = vi.fn();
const mockGenerateScript = vi.fn();
const mockHandleFirstValueGet = vi.fn();
const mockHandleFirstValuePost = vi.fn();

vi.mock('@/seed/auth/better-auth-server', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
}));

vi.mock('better-auth/next-js', () => ({
  toNextJsHandler: (...args: unknown[]) => mockToNextJsHandler(...args),
}));

vi.mock('@/tree/email/sender', () => ({}));

vi.mock('@/seed/db/client', () => ({
  getD1: (...args: unknown[]) => mockGetD1(...args),
  createServerClient: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
  getCurrentUserFromHeaders: (...args: unknown[]) => mockGetCurrentUserFromHeaders(...args),
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  verifyWorkspaceAccess: vi.fn(),
}));

vi.mock('@/seed/security/csrf', () => ({
  verifyCsrfToken: vi.fn(() => true),
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  listUserApiKeyProviders: vi.fn(),
  lookupUserApiKey: (...args: unknown[]) => mockLookupUserApiKey(...args),
  setUserApiKey: (...args: unknown[]) => mockSetUserApiKey(...args),
  clearUserApiKey: (...args: unknown[]) => mockClearUserApiKey(...args),
}));

vi.mock('@/tree/byok/provider-probe', () => ({
  probeProviderApiKey: (...args: unknown[]) => mockProbeProviderKey(...args),
}));

vi.mock('@/seed/ai/script-generator', () => ({
  generateScript: (...args: unknown[]) => mockGenerateScript(...args),
}));

vi.mock('@/land/first-value/first-value-http-handler', () => ({
  handleFirstValueGet: (...args: unknown[]) => mockHandleFirstValueGet(...args),
  handleFirstValuePost: (...args: unknown[]) => mockHandleFirstValuePost(...args),
}));

vi.mock('@/land/promo/promo-validator', () => ({
  validatePromoCode: vi.fn(async () => ({ valid: false, reason: 'invalid_test_code' })),
}));

vi.mock('@/land/promo/promo-applier', () => ({
  applyPromoCode: vi.fn(),
}));

vi.mock('@/tree/handover/handover-account-setup', () => ({
  createCustomerUser: vi.fn(),
}));

import { GET as authAllGet, POST as authAllPost } from '@/app/api/auth/[...all]/route';
import { POST as signInEmailPost } from '@/app/api/auth/sign-in/email/route';
import { POST as signUpPost } from '@/app/api/auth/sign-up/route';
import { POST as mfaChallengePost } from '@/app/api/auth/mfa/challenge/route';
import { processRedeemFreeRequest } from '@/app/api/promo/redeem-free/service/redeem-processor';
import { findOrResolveUser } from '@/app/api/promo/redeem-free/service/user-resolver';
import { GET as firstValueGet, POST as firstValuePost } from '@/app/api/first-value/route';
import type { FirstValueHttpDeps } from '@/land/first-value/first-value-http-handler';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PILOT_INVITE_ONLY = 'true';
  process.env.PILOT_ALLOWED_EMAILS = 'pilot@example.test';
  process.env.ALLOWED_HOSTS = 'pilot.example.test';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('pilot auth route guards & revocation', () => {
  it('blocks uninvited POST on /api/auth/[...all] and forwards allowed email', async () => {
    const innerPost = vi.fn(async () => NextResponse.json({ ok: true }));
    mockToNextJsHandler.mockReturnValue({ GET: vi.fn(), POST: innerPost });
    mockGetAuth.mockResolvedValue({
      api: { getSession: vi.fn(async () => null) },
    });

    const blockedReq = new Request('https://pilot.example.test/api/auth/sign-up/email/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'stranger@example.test', password: 'Password123!' }),
    });
    const blockedRes = await authAllPost(blockedReq);
    expect(blockedRes.status).toBe(403);
    expect(((await blockedRes.json()) as { code: string }).code).toBe('PILOT_INVITE_REQUIRED');
    expect(innerPost).not.toHaveBeenCalled();

    const allowedReq = new Request('https://pilot.example.test/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'pilot@example.test', password: 'Password123!' }),
    });
    const allowedRes = await authAllPost(allowedReq);
    expect(allowedRes.status).toBe(200);
    expect(innerPost).toHaveBeenCalledTimes(1);
  });

  it('revokes non-allowlisted sessions on /api/auth/[...all] GET & POST while allowing sign-out', async () => {
    const innerGet = vi.fn(async () => NextResponse.json({ ok: true }));
    const innerPost = vi.fn(async () => NextResponse.json({ signedOut: true }));
    mockToNextJsHandler.mockReturnValue({ GET: innerGet, POST: innerPost });
    mockGetAuth.mockResolvedValue({
      api: {
        getSession: vi.fn(async () => ({
          user: { id: 'u_revoked', email: 'revoked@example.test' },
          session: { id: 's_1' },
        })),
      },
    });

    const getSessionRes = await authAllGet(
      new Request('https://pilot.example.test/api/auth/get-session/'),
    );
    expect(getSessionRes.status).toBe(200);
    expect(await getSessionRes.json()).toBeNull();

    const otherGetRes = await authAllGet(
      new Request('https://pilot.example.test/api/auth/list-sessions'),
    );
    expect(otherGetRes.status).toBe(403);
    expect(((await otherGetRes.json()) as { code: string }).code).toBe('PILOT_ACCESS_REVOKED');

    const otherPostRes = await authAllPost(
      new Request('https://pilot.example.test/api/auth/revoke-sessions', { method: 'POST' }),
    );
    expect(otherPostRes.status).toBe(403);

    const signOutRes = await authAllPost(
      new Request('https://pilot.example.test/api/auth/sign-out', { method: 'POST' }),
    );
    expect(signOutRes.status).toBe(200);
    expect(innerPost).toHaveBeenCalledTimes(1);
  });

  it('blocks uninvited email on /api/auth/sign-in/email and /api/auth/sign-up', async () => {
    mockGetAuth.mockResolvedValue(null);

    const blockedSignIn = await signInEmailPost(
      new Request('https://pilot.example.test/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'stranger@example.test', password: 'pw' }),
      }),
    );
    expect(blockedSignIn.status).toBe(403);

    const allowedSignIn = await signInEmailPost(
      new Request('https://pilot.example.test/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'pilot@example.test', password: 'pw' }),
      }),
    );
    expect(allowedSignIn.status).toBe(503);

    const blockedSignUp = await signUpPost(
      new NextRequest('https://pilot.example.test/api/auth/sign-up', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'stranger@example.test', password: 'pw' }),
      }),
    );
    expect(blockedSignUp.status).toBe(403);

    const allowedSignUp = await signUpPost(
      new NextRequest('https://pilot.example.test/api/auth/sign-up', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'pilot@example.test', password: 'pw' }),
      }),
    );
    expect(allowedSignUp.status).toBe(503);
  });

  it('rejects revoked pilot sessions on /api/auth/mfa/challenge', async () => {
    mockGetAuth.mockResolvedValue({
      api: {
        getSession: vi.fn(async () => ({
          user: { id: 'u_revoked', email: 'revoked@example.test' },
          session: { id: 's_1' },
        })),
      },
    });
    const revokedRes = await mfaChallengePost(
      new NextRequest('https://pilot.example.test/api/auth/mfa/challenge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: '123456' }),
      }),
    );
    expect(revokedRes.status).toBe(401);

    mockGetAuth.mockResolvedValue({
      api: {
        getSession: vi.fn(async () => ({
          user: { id: 'u_pilot', email: 'pilot@example.test' },
          session: { id: 's_2' },
        })),
      },
    });
    const invalidInputRes = await mfaChallengePost(
      new NextRequest('https://pilot.example.test/api/auth/mfa/challenge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: '12' }),
      }),
    );
    expect(invalidInputRes.status).toBe(400);
  });
});

describe('promo redeem-free pilot invite enforcement', () => {
  it('blocks uninvited email in processRedeemFreeRequest with 403 PILOT_INVITE_REQUIRED', async () => {
    const res = await processRedeemFreeRequest(
      new Request('https://pilot.example.test/api/promo/redeem-free', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'FREE100', email: 'stranger@example.test' }),
      }),
    );
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('PILOT_INVITE_REQUIRED');

    const allowedRes = await processRedeemFreeRequest(
      new Request('https://pilot.example.test/api/promo/redeem-free', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'FREE100', email: 'pilot@example.test' }),
      }),
    );
    expect(allowedRes.status).toBe(400);
  });

  it('guards findOrResolveUser against uninvited email and resolves allowlisted session or D1 row', async () => {
    const blocked = await findOrResolveUser(
      new Request('https://pilot.example.test/api/promo/redeem-free'),
      'stranger@example.test',
    );
    expect(blocked).toEqual({ userId: null, sessionEmailVerified: false });

    mockGetAuth.mockResolvedValue({
      api: {
        getSession: vi.fn(async () => ({
          user: { id: 'u_pilot', email: 'pilot@example.test', emailVerified: true },
        })),
      },
    });
    const fromSession = await findOrResolveUser(
      new Request('https://pilot.example.test/api/promo/redeem-free'),
      'pilot@example.test',
    );
    expect(fromSession).toEqual({ userId: 'u_pilot', sessionEmailVerified: true });

    mockGetAuth.mockResolvedValue({
      api: { getSession: vi.fn(async () => null) },
    });
    mockGetCurrentUserFromHeaders.mockResolvedValue(null);
    mockGetD1.mockResolvedValue({
      prepare: () => ({
        bind: () => ({
          first: async () => ({ id: 'u_d1' }),
        }),
      }),
    });
    const fromD1 = await findOrResolveUser(
      new Request('https://pilot.example.test/api/promo/redeem-free'),
      'pilot@example.test',
    );
    expect(fromD1).toEqual({ userId: 'u_d1', sessionEmailVerified: false });
  });
});

describe('/api/first-value live dependency wiring', () => {
  it('wires lookupOpenRouterByokKey and generateLiveScript into GET and POST handlers', async () => {
    const captured: { deps: FirstValueHttpDeps | null } = { deps: null };
    mockHandleFirstValueGet.mockImplementation(async (_req: NextRequest, deps: FirstValueHttpDeps) => {
      captured.deps = deps;
      return NextResponse.json({ ok: true });
    });
    mockHandleFirstValuePost.mockImplementation(async (_req: NextRequest, deps: FirstValueHttpDeps) => {
      captured.deps = deps;
      return NextResponse.json({ ok: true });
    });

    process.env.FIRST_VALUE_RECEIPT_SECRET = '0123456789abcdef0123456789abcdef';
    const getRes = await firstValueGet(new NextRequest('https://pilot.example.test/api/first-value?orgId=org_1'));
    expect(getRes.status).toBe(200);
    expect(captured.deps?.signingSecret).toBe('0123456789abcdef0123456789abcdef');

    const postRes = await firstValuePost(
      new NextRequest('https://pilot.example.test/api/first-value', { method: 'POST' }),
    );
    expect(postRes.status).toBe(200);

    mockLookupUserApiKey.mockResolvedValueOnce({ status: 'FOUND', key: ' sk-or-test-key ' });
    expect(await captured.deps?.lookupOpenRouterByokKey?.('u_1')).toBe('sk-or-test-key');

    mockLookupUserApiKey.mockResolvedValueOnce({ status: 'NOT_FOUND' });
    expect(await captured.deps?.lookupOpenRouterByokKey?.('u_1')).toBeNull();

    mockProbeProviderKey.mockResolvedValueOnce({ ok: true, valid: true, maskedKey: 'sk-or-...1234' });
    const probeRes = await captured.deps?.probeOpenRouterByokKey?.('sk-or-v1-test1234567890');
    expect(probeRes).toMatchObject({ ok: true, valid: true });
    expect(mockProbeProviderKey).toHaveBeenCalledWith('openrouter', 'sk-or-v1-test1234567890');

    await captured.deps?.saveOpenRouterByokKey?.('u_1', 'sk-or-v1-test1234567890');
    expect(mockSetUserApiKey).toHaveBeenCalledWith('u_1', 'openrouter', 'sk-or-v1-test1234567890');

    await captured.deps?.clearOpenRouterByokKey?.('u_1');
    expect(mockClearUserApiKey).toHaveBeenCalledWith('u_1', 'openrouter');

    mockGenerateScript.mockResolvedValueOnce({ title: 'T', scenes: [], total_duration: 30 });
    await captured.deps?.generateLiveScript?.({
      topic: 'Topic',
      audience: 'Audience',
      durationSec: 30,
      userId: 'u_1',
      apiKey: 'sk-or-test-key',
    });
    expect(mockGenerateScript).toHaveBeenCalledWith(
      {
        topic: 'Topic',
        audience: 'Audience',
        tier: 'BASIC',
        durationSec: 30,
        userId: 'u_1',
      },
      {
        funding: { fund: 'byok', apiKey: 'sk-or-test-key' },
        minScenes: 3,
      },
    );
  });
});
