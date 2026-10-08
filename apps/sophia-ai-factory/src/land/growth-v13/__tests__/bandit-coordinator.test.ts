import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBanditExperiment,
  recordArmPull,
  insertShapleyTouchpoint,
} from '../bandit-coordinator';
import { getD1 } from '@/seed/db/client';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

describe('Bandit Coordinator Land Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates bandit experiment with atomic CAS conflict handling', async () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    vi.mocked(getD1).mockResolvedValue({ prepare: mockPrepare } as any);

    const result = await createBanditExperiment({
      id: 'exp-test',
      userId: 'user-1',
      experimentName: 'Test Hook Experiment',
      status: 'ACTIVE',
      totalPulls: 0,
      arms: [],
      convergenceThreshold: 0.95,
      minPullsBeforeConvergence: 50,
    });

    expect(result).toBe(true);
    expect(mockPrepare).toHaveBeenCalled();
  });

  it('records arm pull increment in D1', async () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    vi.mocked(getD1).mockResolvedValue({ prepare: mockPrepare } as any);

    const result = await recordArmPull('arm-1', true);
    expect(result).toBe(true);
    expect(mockBind).toHaveBeenCalledWith(1, 1.0, 0.0, expect.any(Number), 'arm-1');
  });

  it('inserts Shapley touchpoint record', async () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    vi.mocked(getD1).mockResolvedValue({ prepare: mockPrepare } as any);

    const result = await insertShapleyTouchpoint(
      'user-1',
      'conv-123',
      {
        videoManifestId: 'vid-1',
        channelId: 'chan-1',
        platform: 'YOUTUBE_SHORTS',
        timestamp: Date.now(),
        mcuCostUsd: 1.5,
      },
      1,
      0.65,
      32.5
    );

    expect(result).toBe(true);
  });
});
