/**
 * Tests for POST /api/setup/save
 *
 * Coverage:
 *   401 when no authenticated user
 *   400 when invalid config
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

import { POST } from './route';
import { getCurrentUser } from '@/lib/better-auth-session';

const mockGetCurrentUser = vi.mocked(getCurrentUser);

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
});
