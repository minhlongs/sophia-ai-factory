// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetAuth = vi.fn();

vi.mock('react', () => ({
  cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

vi.mock('@/seed/auth/better-auth-server', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
}));

const AUTH_HEADERS = new Headers({ cookie: 'better-auth.session_token=test-token' });

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => AUTH_HEADERS),
}));

vi.mock('next/navigation', () => ({
  unstable_rethrow: vi.fn(),
}));

import { getCurrentUser, getSession } from '@/seed/auth/better-auth-session';
import { getSessionFromHeaders } from '@/seed/auth/better-auth-headers-session';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PILOT_INVITE_ONLY = 'true';
  process.env.PILOT_ALLOWED_EMAILS = 'pilot@example.test';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('pilot session revocation in better-auth-session & better-auth-headers-session', () => {
  it('returns null from getSession, getCurrentUser, and getSessionFromHeaders when email is removed from allowlist', async () => {
    mockGetAuth.mockResolvedValue({
      api: {
        getSession: vi.fn(async () => ({
          user: { id: 'u_revoked', email: 'revoked@example.test', name: 'Revoked' },
          session: { id: 's_1', mfaPending: false },
        })),
      },
    });

    expect(await getSession()).toBeNull();
    expect(await getCurrentUser()).toBeNull();
    expect(await getSessionFromHeaders(AUTH_HEADERS)).toBeNull();
  });

  it('returns session and user when email is allowlisted', async () => {
    mockGetAuth.mockResolvedValue({
      api: {
        getSession: vi.fn(async () => ({
          user: { id: 'u_pilot', email: 'pilot@example.test', name: 'Pilot Customer' },
          session: { id: 's_2', mfaPending: false },
        })),
      },
    });

    const session = await getSession();
    expect(session?.user?.email).toBe('pilot@example.test');
    const user = await getCurrentUser();
    expect(user?.id).toBe('u_pilot');
    const fromHeaders = await getSessionFromHeaders(AUTH_HEADERS);
    expect(fromHeaders?.user.id).toBe('u_pilot');
  });
});
