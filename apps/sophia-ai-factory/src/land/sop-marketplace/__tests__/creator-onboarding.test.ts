/**
 * Tests for Creator Onboarding Server Actions
 *
 * Unit tests for registerCreator, getCreatorProfile, and updateCreatorProfile
 * by mocking auth, DB, and marketplace-ops dependencies.
 *
 * @module land/sop-marketplace/__tests__/creator-onboarding
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';

// ── Module-level mocks ─────────────────────────────────────────────────────

const mockUser = { id: 'user-creator-001', email: 'creator@example.com' };
const mockProfile = {
  id: 'profile-001',
  user_id: 'user-creator-001',
  display_name: 'Test Creator',
  bio: 'Building SOPs',
  avatar_url: null,
  payout_method: 'nowpayments',
  payout_address: 'TRC20-test-addr',
  total_earnings_cents: 0,
  total_paid_cents: 0,
  status: 'pending',
  created_at: 1000000,
  updated_at: 1000000,
};

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/db/org-membership', () => ({
  requireOrgMembership: vi.fn(),
}));

vi.mock('@/seed/db/marketplace-ops', () => ({
  createCreatorProfile: vi.fn(),
  getCreatorProfile: vi.fn(),
  updateCreatorProfile: vi.fn(),
}));

vi.mock('../beta-invites', () => ({
  validateInviteCode: vi.fn().mockResolvedValue({ valid: true }),
}));

// Import module under test after mocks
import { registerCreator, getCreatorProfile, updateCreatorProfile } from '../creator-onboarding';

beforeEach(async () => {
  vi.clearAllMocks();
  const { requireOrgMembership: orgCheck } = await import('@/seed/db/org-membership');
  vi.mocked(orgCheck).mockResolvedValue({ authorized: true, orgId: 'test-org', role: 'owner' });
});

describe('registerCreator', () => {
  const validFormData = {
    displayName: 'New Creator',
    bio: 'My creator bio',
    payoutMethod: 'nowpayments' as const,
    payoutAddress: 'TRC20-addr-456',
  };

  it('returns success with valid auth and data', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getCreatorProfile: dbGet, createCreatorProfile: dbCreate } = await import(
      '@/seed/db/marketplace-ops'
    );

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockReturnValue({} as unknown as D1Database);
    vi.mocked(dbGet).mockResolvedValue(null); // not yet registered
    vi.mocked(dbCreate).mockResolvedValue(mockProfile as any);

    const result = await registerCreator(validFormData);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.profileId).toBe('profile-001');
    }
  });

  it('returns NOT_AUTHENTICATED when no user', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await registerCreator(validFormData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_AUTHENTICATED');
    }
  });

  it('returns ALREADY_REGISTERED when profile already exists', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getCreatorProfile: dbGet } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockReturnValue({} as unknown as D1Database);
    vi.mocked(dbGet).mockResolvedValue(mockProfile as any);

    const result = await registerCreator(validFormData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ALREADY_REGISTERED');
    }
  });

  it('returns VALIDATION_ERROR for invalid email or bad data', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

    const result = await registerCreator({
      displayName: '', // empty — fails min(1)
      payoutMethod: 'nowpayments',
      payoutAddress: 'addr',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns VALIDATION_ERROR for invalid payout method', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

    const result = await registerCreator({
      displayName: 'Bad Creator',
      payoutMethod: 'invalid-method' as any,
      payoutAddress: 'addr',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('getCreatorProfile', () => {
  it('returns the creator profile when one exists', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getCreatorProfile: dbGet } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockReturnValue({} as unknown as D1Database);
    vi.mocked(dbGet).mockResolvedValue(mockProfile as any);

    const result = await getCreatorProfile();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.displayName).toBe('Test Creator');
      expect(result.value.userId).toBe('user-creator-001');
    }
  });

  it('returns PROFILE_NOT_FOUND when no profile', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getCreatorProfile: dbGet } = await import('@/seed/db/marketplace-ops');

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockReturnValue({} as unknown as D1Database);
    vi.mocked(dbGet).mockResolvedValue(null);

    const result = await getCreatorProfile();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROFILE_NOT_FOUND');
    }
  });
});

describe('updateCreatorProfile', () => {
  it('updates profile with valid data', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { getD1 } = await import('@/seed/db/client');
    const { getCreatorProfile: dbGet, updateCreatorProfile: dbUpdate } = await import(
      '@/seed/db/marketplace-ops'
    );

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(getD1).mockReturnValue({} as unknown as D1Database);
    vi.mocked(dbGet).mockResolvedValue(mockProfile as any);
    vi.mocked(dbUpdate).mockResolvedValue({
      ...mockProfile,
      display_name: 'Updated Name',
      bio: 'Updated bio',
      status: 'active',
    } as any);

    const result = await updateCreatorProfile({
      displayName: 'Updated Name',
      bio: 'Updated bio',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.profileId).toBe('profile-001');
    }
  });
});
