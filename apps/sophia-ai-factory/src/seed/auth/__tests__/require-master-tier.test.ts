/**
 * Tests for `requireMasterTier()` — admin route gate.
 *
 * Verifies: no-user → redirect to login; non-MASTER → redirect to deny URL;
 * MASTER → returns user; custom redirect overrides honored.
 *
 * @module seed/auth/__tests__/require-master-tier.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@/seed/db/client';

// Mocks must be declared before module under test is imported.
const redirectMock = vi.fn((url: string) => {
  // Mirror Next.js: throw a sentinel error so callers cannot continue.
  // Real redirect() has return type `never`.
  const err = new Error(`NEXT_REDIRECT:${url}`);
  (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
  throw err;
});

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

const getCurrentUserMock = vi.fn();
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: getCurrentUserMock,
}));

const getUserTierMock = vi.fn();
vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: getUserTierMock,
}));

const SAMPLE_USER: User = {
  id: 'user-test-1',
  email: 'master@example.com',
  full_name: 'Master User',
  avatar_url: null,
  role: 'user',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as unknown as User;

beforeEach(() => {
  redirectMock.mockClear();
  getCurrentUserMock.mockReset();
  getUserTierMock.mockReset();
});

describe('requireMasterTier', () => {
  it('redirects to /login when no current user', async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const { requireMasterTier } = await import('../require-master-tier');

    await expect(requireMasterTier()).rejects.toThrow(/NEXT_REDIRECT:\/login/);
    expect(redirectMock).toHaveBeenCalledWith('/login');
    expect(getUserTierMock).not.toHaveBeenCalled();
  });

  it('redirects to deny URL when user has non-MASTER tier', async () => {
    getCurrentUserMock.mockResolvedValue(SAMPLE_USER);
    getUserTierMock.mockResolvedValue('PREMIUM');
    const { requireMasterTier } = await import('../require-master-tier');

    await expect(requireMasterTier()).rejects.toThrow(
      /NEXT_REDIRECT:\/dashboard\?error=admin_required/,
    );
    expect(redirectMock).toHaveBeenCalledWith('/dashboard?error=admin_required');
  });

  it('redirects to deny URL when tier is BASIC', async () => {
    getCurrentUserMock.mockResolvedValue(SAMPLE_USER);
    getUserTierMock.mockResolvedValue('BASIC');
    const { requireMasterTier } = await import('../require-master-tier');

    await expect(requireMasterTier()).rejects.toThrow(
      /NEXT_REDIRECT:\/dashboard/,
    );
  });

  it('returns user when tier is MASTER', async () => {
    getCurrentUserMock.mockResolvedValue(SAMPLE_USER);
    getUserTierMock.mockResolvedValue('MASTER');
    const { requireMasterTier } = await import('../require-master-tier');

    const user = await requireMasterTier();
    expect(user).toEqual(SAMPLE_USER);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('honors custom loginRedirect when user missing', async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const { requireMasterTier } = await import('../require-master-tier');

    await expect(
      requireMasterTier({ loginRedirect: '/sign-in?next=/dashboard/admin' }),
    ).rejects.toThrow(/NEXT_REDIRECT:\/sign-in/);
    expect(redirectMock).toHaveBeenCalledWith('/sign-in?next=/dashboard/admin');
  });

  it('honors custom denyRedirect when tier denied', async () => {
    getCurrentUserMock.mockResolvedValue(SAMPLE_USER);
    getUserTierMock.mockResolvedValue('ENTERPRISE');
    const { requireMasterTier } = await import('../require-master-tier');

    await expect(
      requireMasterTier({ denyRedirect: '/?denied=admin' }),
    ).rejects.toThrow(/NEXT_REDIRECT:\/\?denied=admin/);
    expect(redirectMock).toHaveBeenCalledWith('/?denied=admin');
  });
});
