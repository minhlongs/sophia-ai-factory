import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createBanditExperimentAction,
  requestCreativeDeliberationAction,
} from '../flywheel-v13-actions';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import type { User } from '@/seed/db/client';
import { getUserTier } from '@/seed/db/get-user-tier';
import { inngest } from '@/seed/inngest/client';
import * as coordinator from '../bandit-coordinator';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn().mockResolvedValue('PREMIUM'),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt-1'] }),
  },
}));

vi.mock('../bandit-coordinator', () => ({
  createBanditExperiment: vi.fn(),
}));

describe('Flywheel v13 Server Actions', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SOPHIA_EDITION;
    vi.mocked(getUserTier).mockResolvedValue('PREMIUM');
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('rejects unauthenticated user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await createBanditExperimentAction('Test', ['Hook 1', 'Hook 2']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('blocks community edition users with FEATURE_LOCKED on both actions', async () => {
    process.env.SOPHIA_EDITION = 'community';
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as unknown as User);

    const expRes = await createBanditExperimentAction('Test Exp', ['Hook 1', 'Hook 2']);
    expect(expRes.ok).toBe(false);
    if (!expRes.ok) {
      expect(expRes.error.code).toBe('FEATURE_LOCKED');
    }

    const delibRes = await requestCreativeDeliberationAction('script-1', 'Full script text');
    expect(delibRes.ok).toBe(false);
    if (!delibRes.ok) {
      expect(delibRes.error.code).toBe('FEATURE_LOCKED');
    }
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('rejects invalid experiment parameters', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as unknown as User);
    const result = await createBanditExperimentAction('Test', ['Only One Hook']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('successfully creates experiment and dispatches evaluation event', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as unknown as User);
    vi.mocked(coordinator.createBanditExperiment).mockResolvedValue(true);

    const result = await createBanditExperimentAction('Test Exp', ['Hook 1', 'Hook 2']);
    expect(result.ok).toBe(true);
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'growth/v13.bandit.evaluate',
      }),
    );
  });

  it('successfully requests creative deliberation', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as unknown as User);
    const result = await requestCreativeDeliberationAction('script-1', 'Full script text');
    expect(result.ok).toBe(true);
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'growth/v13.deliberation.request',
      }),
    );
  });
});
