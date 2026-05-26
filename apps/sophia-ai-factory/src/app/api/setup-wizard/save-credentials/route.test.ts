/**
 * Tests for POST /api/setup-wizard/save-credentials.
 *
 * This route is the canonical user-facing HeyGen credential save path used by
 * Setup Wizard. Auto-video render must later resolve the same credential via
 * getHeyGenKey(userId), not the generic user_api_keys table.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/tree/credentials/user-credentials-repo', () => ({
  setUserCredential: vi.fn(),
}));

vi.mock('@/lib/heygen/webhook-registrar', () => ({
  registerHeyGenWebhook: vi.fn(),
}));

const mockRun = vi.fn().mockResolvedValue({});
const mockFirst = vi.fn().mockResolvedValue({ 1: 1 });
const mockBind = vi.fn(() => ({ run: mockRun, first: mockFirst }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

vi.mock('@/seed/db/client', () => ({
  getD1Raw: vi.fn(() => Promise.resolve({ prepare: mockPrepare })),
}));

vi.mock('@/forest/outbox/email-outbox', () => ({
  enqueueWelcomeEmail: vi.fn(),
}));

import { POST } from './route';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { setUserCredential } from '@/tree/credentials/user-credentials-repo';
import { registerHeyGenWebhook } from '@/lib/heygen/webhook-registrar';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockSetUserCredential = vi.mocked(setUserCredential);
const mockRegisterHeyGenWebhook = vi.mocked(registerHeyGenWebhook);

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/setup-wizard/save-credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('POST /api/setup-wizard/save-credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockResolvedValue({});
    mockFirst.mockResolvedValue({ 1: 1 });
    mockBind.mockImplementation(() => ({ run: mockRun, first: mockFirst }));
    mockPrepare.mockImplementation(() => ({ bind: mockBind }));
    mockSetUserCredential.mockResolvedValue(undefined);
    mockRegisterHeyGenWebhook.mockResolvedValue({
      success: false,
      error: 'webhook registration skipped in test',
    });
  });

  it('returns 401 when no authenticated user', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await POST(makeRequest({ heygen_api_key: 'hg_test' }));

    expect(res.status).toBe(401);
    expect(mockSetUserCredential).not.toHaveBeenCalled();
  });

  it('returns 400 when no credential is provided', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: null } as never);

    const res = await POST(makeRequest({}));
    const json = (await res.json()) as { success: boolean; message: string };

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.message).toBe('No credentials provided');
  });

  it('saves HeyGen to user_provider_credentials and treats webhook failure as non-fatal', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: null } as never);

    const res = await POST(makeRequest({ heygen_api_key: 'hg_live_user_key' }));
    const json = (await res.json()) as {
      success: boolean;
      saved: string[];
      webhook_registered: boolean;
      errors?: string[];
    };

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.saved).toContain('heygen');
    expect(json.webhook_registered).toBe(false);
    expect(json.errors?.[0]).toContain('webhook:');
    expect(mockSetUserCredential).toHaveBeenCalledWith('user-1', 'heygen', 'hg_live_user_key');
    expect(mockRegisterHeyGenWebhook).toHaveBeenCalledWith(
      'hg_live_user_key',
      'https://sophia.agencyos.network/api/webhooks/heygen',
    );
  });

  it('sanitizes and trims all incoming credentials', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: null } as never);

    const res = await POST(
      makeRequest({
        heygen_api_key: ' \nhg_live_user_key\u200B ',
        resend_api_key: '  re_testkey\uFEFF\r\n',
      })
    );
    expect(res.status).toBe(200);
    expect(mockSetUserCredential).toHaveBeenCalledWith('user-1', 'heygen', 'hg_live_user_key');
    expect(mockSetUserCredential).toHaveBeenCalledWith('user-1', 'resend', 're_testkey');
  });
});
