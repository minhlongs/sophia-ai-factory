/**
 * Unit tests: completeOnboardingAction — success + DB error path (C4 regression lock)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const { mockGetCurrentUser, mockDbFrom, mockRevalidatePath } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockDbFrom: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({ from: mockDbFrom }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeUpdateChain(errorResult: { message: string } | null) {
  const chain: Record<string, unknown> = {};
  const result = { data: errorResult ? null : [{ user_id: 'u1' }], error: errorResult };
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => Promise.resolve(result));
  return chain;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'x@test.com' });
});

describe('completeOnboardingAction', () => {
  it('returns { success: true } when D1 update returns no error', async () => {
    mockDbFrom.mockReturnValue(makeUpdateChain(null));

    const { completeOnboardingAction } = await import('../complete-onboarding-action');
    const result = await completeOnboardingAction({ reason: 'complete' });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('returns { success: false, error } when D1 returns an error object', async () => {
    mockDbFrom.mockReturnValue(makeUpdateChain({ message: 'simulated D1 error' }));

    const { completeOnboardingAction } = await import('../complete-onboarding-action');
    const result = await completeOnboardingAction({ reason: 'skip' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('simulated D1 error');
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns { success: false, error: unauthorized } when no user session', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { completeOnboardingAction } = await import('../complete-onboarding-action');
    const result = await completeOnboardingAction();

    expect(result.success).toBe(false);
    expect(result.error).toBe('unauthorized');
  });
});
