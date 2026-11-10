/**
 * @file growth-triad-v8-actions.test.ts
 * @description Unit tests for Growth Triad v8 Server Actions
 * @layer land
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dispatchAudioResonance,
  dispatchCommunityBait,
  dispatchCohortLtvEvaluation,
} from '../actions/growth-triad-v8-actions';

// Mock Auth
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));
import { getCurrentUser } from '@/seed/auth/better-auth-session';

// Mock Inngest
vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: vi.fn() },
}));
import { inngest } from '@/seed/inngest/client';

describe('Growth Triad v8 Actions (Land Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dispatchAudioResonance', () => {
    it('returns failure when unauthenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

      const result = await dispatchAudioResonance('tr-123', 128, [1.0, 2.0]);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.code).toBe('UNAUTHORIZED');
    });

    it('dispatches to inngest and returns success when authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u1' } as never);

      const result = await dispatchAudioResonance('tr-123', 128, [1.0, 2.0]);
      expect(result.ok).toBe(true);
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'audio.resonance.synced',
          data: expect.objectContaining({
            audioTrackId: 'tr-123',
            bpm: 128,
          }),
        })
      );
    });

    it('denies on community edition with FEATURE_LOCKED across all v8 actions', async () => {
      process.env.SOPHIA_EDITION = 'community';
      try {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as never);
        const r1 = await dispatchAudioResonance('tr-123', 128, [1.0]);
        const r2 = await dispatchCommunityBait('vid-1', 'Hook');
        const r3 = await dispatchCohortLtvEvaluation('2026-10', 100);
        expect(!r1.ok && r1.error.code).toBe('FEATURE_LOCKED');
        expect(!r2.ok && r2.error.code).toBe('FEATURE_LOCKED');
        expect(!r3.ok && r3.error.code).toBe('FEATURE_LOCKED');
      } finally {
        delete process.env.SOPHIA_EDITION;
      }
    });

    it('returns sanitized error message on dispatch failure across all v8 actions', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as never);
      vi.mocked(inngest.send).mockRejectedValueOnce(new Error('inngest down'));
      const r1 = await dispatchAudioResonance('tr-123', 128, [1.0]);
      expect(!r1.ok && r1.error.code).toBe('SERVER_ERROR');

      vi.mocked(inngest.send).mockRejectedValueOnce('raw-err');
      const r2 = await dispatchCommunityBait('vid-1', 'Hook');
      expect(!r2.ok && r2.error.code).toBe('SERVER_ERROR');

      vi.mocked(inngest.send).mockRejectedValueOnce(new Error('ltv err'));
      const r3 = await dispatchCohortLtvEvaluation('2026-10', 100);
      expect(!r3.ok && r3.error.code).toBe('SERVER_ERROR');
    });
  });

  describe('dispatchCommunityBait', () => {
    it('dispatches bait generation successfully', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u1' } as never);

      const result = await dispatchCommunityBait('vid-99', 'SaaS Marketing');
      expect(result.ok).toBe(true);
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'community.bait.generated',
          data: expect.objectContaining({
            videoId: 'vid-99',
            primaryHookQuestion: 'SaaS Marketing',
          }),
        })
      );
    });
  });

  describe('dispatchCohortLtvEvaluation', () => {
    it('dispatches LTV evaluation successfully', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u1' } as never);

      const result = await dispatchCohortLtvEvaluation('2026-10', 1500);
      expect(result.ok).toBe(true);
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'subscriber.cohort.evaluated',
          data: expect.objectContaining({
            cohortMonth: '2026-10',
          }),
        })
      );
    });
  });
});
