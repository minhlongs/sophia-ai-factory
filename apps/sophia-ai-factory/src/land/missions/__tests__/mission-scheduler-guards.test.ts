/**
 * Pre-side-effect guard tests for the auto-video mission scheduler.
 *
 * `submitMissionVideo` must not reach the render provider when the workspace
 * emergency kill switch is active — or when its state cannot be read. The
 * legacy boolean helper fails OPEN on read errors; the scheduler uses the
 * state-aware read and fails closed.
 *
 * @module land/missions/__tests__/mission-scheduler-guards.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitMissionVideo } from '@/land/missions/auto-video/mission-scheduler';
import { submitByokVideo } from '@/land/video/generation/render-byok-video';
import { getAffiliateKillSwitchState } from '@/tree/affiliate/kill-switch/kill-switch-store';

vi.mock('@/tree/affiliate/kill-switch/kill-switch-store', () => ({
  getAffiliateKillSwitchState: vi.fn(),
}));

vi.mock('@/land/video/generation/render-byok-video', () => ({
  submitByokVideo: vi.fn(),
  RenderByokVideoError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'RenderByokVideoError';
      this.code = code;
    }
  },
}));

describe('submitMissionVideo pre-side-effect guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAffiliateKillSwitchState).mockResolvedValue({ active: false, known: true });
  });

  it('throws KILL_SWITCH_UNKNOWN and never calls the render provider when the halt state is unreadable', async () => {
    vi.mocked(getAffiliateKillSwitchState).mockResolvedValue({
      active: false,
      known: false,
      reason: 'D1 read failed',
    });

    await expect(
      submitMissionVideo({ userId: 'u', topic: 't' }, 'script', 'title', 'mission_1'),
    ).rejects.toMatchObject({ code: 'KILL_SWITCH_UNKNOWN' });
    expect(submitByokVideo).not.toHaveBeenCalled();
  });

  it('throws KILL_SWITCH_ACTIVE when the halt is actively engaged', async () => {
    vi.mocked(getAffiliateKillSwitchState).mockResolvedValue({ active: true, known: true });

    await expect(
      submitMissionVideo({ userId: 'u', topic: 't' }, 'script', 'title', 'mission_1'),
    ).rejects.toMatchObject({ code: 'KILL_SWITCH_ACTIVE' });
    expect(submitByokVideo).not.toHaveBeenCalled();
  });

  it('submits the render when the halt is off and known', async () => {
    vi.mocked(submitByokVideo).mockResolvedValue({
      videoId: 'vid_1',
      heygenJobId: 'hj_1',
      status: 'queued',
    } as never);

    const video = await submitMissionVideo({ userId: 'u', topic: 't' }, 'script', 'title', 'mission_1');

    expect(submitByokVideo).toHaveBeenCalledTimes(1);
    expect(video?.videoId).toBe('vid_1');
  });
});
