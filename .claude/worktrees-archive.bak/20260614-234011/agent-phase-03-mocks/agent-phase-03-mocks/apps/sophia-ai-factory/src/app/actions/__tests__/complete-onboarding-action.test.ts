/**
 * Unit tests: completeOnboardingAction — success + DB error path (C4 regression lock)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const { mockGetCurrentUser, mockRun, mockRevalidatePath } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockRun: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
  getD1Raw: vi.fn(async () => ({
    prepare: (_sql: string) => ({
      bind: (..._args: unknown[]) => ({
        run: mockRun,
      }),
    }),
  })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'x@test.com' });
});

describe('completeOnboardingAction', () => {
  it('returns { success: true } when D1 upsert resolves', async () => {
    mockRun.mockResolvedValue({ success: true });

    const { completeOnboardingAction } = await import('../complete-onboarding-action');
    const result = await completeOnboardingAction({ reason: 'complete' });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/onboarding');
  });

  it('returns { success: false, error } when D1 throws', async () => {
    mockRun.mockRejectedValue(new Error('simulated D1 error'));

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
