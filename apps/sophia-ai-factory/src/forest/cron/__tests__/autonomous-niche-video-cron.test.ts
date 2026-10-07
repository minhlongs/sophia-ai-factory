/**
 * Autonomous Niche Video Cron Vitest Suite
 *
 * Verifies autonomous deal filtering, jurisdiction compliance screening,
 * and dispatch of Inngest workflows.
 *
 * @module forest/cron/__tests__/autonomous-niche-video-cron.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAutonomousNicheVideoCron } from '../autonomous-niche-video-cron';

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt_cron_123'] }),
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Autonomous Niche Video Cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs autonomous cycle, screening out banned deals while dispatching compliant ones', async () => {
    const result = await runAutonomousNicheVideoCron();

    expect(result.success).toBe(true);
    expect(result.totalCandidates).toBe(4);
    // 3 deals compliant (SaaS 1, SaaS 2, Crypto US), 1 deal rejected (Crypto VN promotional ban)
    expect(result.dispatchedCount).toBe(3);
    expect(result.rejectedCount).toBe(1);
  });
});
