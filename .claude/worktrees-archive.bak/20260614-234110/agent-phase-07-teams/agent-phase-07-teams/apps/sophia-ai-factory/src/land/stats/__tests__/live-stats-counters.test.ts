/**
 * Unit tests for getLiveStats — D1 mocked; covers happy path,
 * floor-clamp guarantee, and degrade-on-error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetD1Raw, mockFirst } = vi.hoisted(() => {
  const first = vi.fn();
  return {
    mockFirst: first,
    mockGetD1Raw: vi.fn().mockResolvedValue({
      prepare: () => ({
        first,
      }),
    }),
  };
});

vi.mock('@/seed/db/client', () => ({
  getD1Raw: mockGetD1Raw,
}));

import { getLiveStats } from '@/land/stats/live-stats-counters';

describe('getLiveStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses live counts when above floor', async () => {
    mockFirst
      .mockResolvedValueOnce({ n: 1234 })   // missions
      .mockResolvedValueOnce({ n: 87 })     // agencies
      .mockResolvedValueOnce({ n: 4500 });  // videos
    const s = await getLiveStats();
    expect(s.missionsCompleted).toBe(1234);
    expect(s.paidAgencies).toBe(87);
    expect(s.videosGenerated).toBe(4500);
    expect(s.generatedAt).toBeGreaterThan(0);
  });

  it('clamps to floor when live is below baseline', async () => {
    mockFirst
      .mockResolvedValueOnce({ n: 12 })     // missions < 500
      .mockResolvedValueOnce({ n: 3 })      // agencies < 50
      .mockResolvedValueOnce({ n: 5 });     // videos < 1000
    const s = await getLiveStats();
    expect(s.missionsCompleted).toBe(500);
    expect(s.paidAgencies).toBe(50);
    expect(s.videosGenerated).toBe(1000);
  });

  it('falls back to floor when D1 throws', async () => {
    mockGetD1Raw.mockRejectedValueOnce(new Error('D1 down'));
    mockGetD1Raw.mockRejectedValueOnce(new Error('D1 down'));
    mockGetD1Raw.mockRejectedValueOnce(new Error('D1 down'));
    const s = await getLiveStats();
    expect(s.missionsCompleted).toBe(500);
    expect(s.paidAgencies).toBe(50);
    expect(s.videosGenerated).toBe(1000);
  });

  it('coerces string n (D1 returns count as string)', async () => {
    mockFirst
      .mockResolvedValueOnce({ n: '700' })
      .mockResolvedValueOnce({ n: '52' })
      .mockResolvedValueOnce({ n: '1100' });
    const s = await getLiveStats();
    expect(s.missionsCompleted).toBe(700);
    expect(s.paidAgencies).toBe(52);
    expect(s.videosGenerated).toBe(1100);
  });
});
