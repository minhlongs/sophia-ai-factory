/**
 * Tests for POST /api/setup/save
 *
 * Coverage:
 *   401 when no authenticated user
 *   400 when no LLM key provided (openrouter or anthropic)
 *   200 with openrouter-only
 *   200 with anthropic-only
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/actions/settings', () => ({
  encryptAndSaveSettings: vi.fn(),
}));

vi.mock('@/lib/byok/user-api-key-store', () => ({
  setUserApiKey: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from './route';
import { getCurrentUser } from '@/lib/better-auth-session';
import { setUserApiKey } from '@/lib/byok/user-api-key-store';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockSetUserApiKey = vi.mocked(setUserApiKey);

const MOCK_USER = { id: 'user-1', email: 'test@example.com', name: 'Test' };

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/setup/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('POST /api/setup/save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default mock implementations after clearAllMocks
    mockSetUserApiKey.mockResolvedValue(undefined);
  });

  it('returns 401 when no authenticated user', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(
      makeRequest({
        config: { OPENROUTER_API_KEY: 'test-key' },
      }),
    );
    expect(res.status).toBe(401);
    const json = (await res.json()) as { message: string };
    expect(json.message).toBe('Unauthorized');
  });

  it('returns 400 when no LLM key provided (empty config)', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER as never);
    const res = await POST(
      makeRequest({
        config: {
          ELEVENLABS_API_KEY: 'sk_voice',
          DID_API_KEY: 'Basic did',
          MUAPI_API_KEY: 'mu_audio',
        },
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { message: string };
    expect(json.message).toContain('LLM provider key required');
  });

  it('returns 400 when config is entirely empty', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER as never);
    const res = await POST(makeRequest({ config: {} }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { message: string };
    expect(json.message).toContain('LLM provider key required');
  });

  it('returns 200 with openrouter-only key', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER as never);
    mockSetUserApiKey.mockResolvedValue(undefined);
    const res = await POST(
      makeRequest({
        config: { OPENROUTER_API_KEY: 'sk-or-test-key' },
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; saved: string[] };
    expect(json.success).toBe(true);
    expect(json.saved).toContain('openrouter');
  });

  it('returns 200 with anthropic-only key', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER as never);
    mockSetUserApiKey.mockResolvedValue(undefined);
    const res = await POST(
      makeRequest({
        config: { ANTHROPIC_API_KEY: 'sk-ant-test-key' },
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; saved: string[] };
    expect(json.success).toBe(true);
    expect(json.saved).toContain('anthropic');
  });

  it('sets wizard_done cookie on success', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER as never);
    mockSetUserApiKey.mockResolvedValue(undefined);
    const res = await POST(
      makeRequest({
        config: { OPENROUTER_API_KEY: 'sk-or-test-key' },
      }),
    );
    expect(res.status).toBe(200);
    const setCookieHeader = res.headers.get('set-cookie');
    expect(setCookieHeader).toContain('wizard_done=1');
  });
});
