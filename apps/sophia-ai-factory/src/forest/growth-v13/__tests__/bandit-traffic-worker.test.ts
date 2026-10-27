/** The v13 bandit worker must never evaluate fabricated arms. */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_c: unknown, _t: unknown, handler: unknown) => handler),
  },
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { banditTrafficWorker } from '../bandit-traffic-worker';

describe('banditTrafficWorker (inactive)', () => {
  it('returns NOT_AVAILABLE rather than promoting a hardcoded winner', async () => {
    const handler = banditTrafficWorker as unknown as (ctx: {
      event: { data: { experimentId: string; userId: string } };
      step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> };
    }) => Promise<{ success: boolean; status: string; reason: string }>;
    const result = await handler({
      event: { data: { experimentId: 'exp_1', userId: 'usr_1' } },
      step: { run: async <T>(_n: string, fn: () => Promise<T>) => await fn() },
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe('NOT_AVAILABLE');
    expect(result.reason).toBe('PERSISTED_ARMS_REQUIRED');
  });
});
