import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBanditExperimentAction,
  requestCreativeDeliberationAction,
} from '../flywheel-v13-actions';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import * as coordinator from '../bandit-coordinator';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await createBanditExperimentAction('Test', ['Hook 1', 'Hook 2']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('rejects invalid experiment parameters', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any);
    const result = await createBanditExperimentAction('Test', ['Only One Hook']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('successfully creates experiment and dispatches evaluation event', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any);
    vi.mocked(coordinator.createBanditExperiment).mockResolvedValue(true);

    const result = await createBanditExperimentAction('Test Exp', ['Hook 1', 'Hook 2']);
    expect(result.ok).toBe(true);
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'growth/v13.bandit.evaluate',
      })
    );
  });

  it('successfully requests creative deliberation', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any);
    const result = await requestCreativeDeliberationAction('script-1', 'Full script text');
    expect(result.ok).toBe(true);
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'growth/v13.deliberation.request',
      })
    );
  });
});
