/**
 * Integration test: Onboarding page render + redirect logic.
 * @vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ get: vi.fn() }) }));
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn(),
}));
vi.mock('@/app/actions/complete-onboarding-action', () => ({
  completeOnboardingAction: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// D1 not available on test env — null fallback
vi.stubGlobal('__env', undefined);

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import OnboardingPage from '../page';

const mockRedirect = vi.mocked(redirect);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockGetUserTier = vi.mocked(getUserTier);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OnboardingPage', () => {
  it('redirects to /login when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await OnboardingPage({ params: Promise.resolve({ locale: 'en' }) });

    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('renders wizard for non-MASTER tier (canonical onboarding URL serves all tiers)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'test@test.com', full_name: 'Test User' } as never);
    mockGetUserTier.mockResolvedValue('PREMIUM');

    const result = await OnboardingPage({ params: Promise.resolve({ locale: 'en' }) });

    // Non-MASTER users see wizard, not redirected away — per phase-02 decision
    expect(mockRedirect).not.toHaveBeenCalledWith('/dashboard');
    expect(result).not.toBeNull();
  });

  it('renders without crashing for MASTER user with no D1 available', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-master', email: 'free@test.com', full_name: 'Free User' } as never);
    mockGetUserTier.mockResolvedValue('MASTER');

    // Should not throw — D1 null fallback means all steps = false
    const result = await OnboardingPage({ params: Promise.resolve({ locale: 'en' }) });

    // Page renders (result is JSX element)
    expect(result).not.toBeNull();
    // No redirect to /dashboard since not all steps done
    expect(mockRedirect).not.toHaveBeenCalledWith('/dashboard');
  });
});
