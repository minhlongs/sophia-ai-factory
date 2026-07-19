import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RnnScheduler } from '../rnn-scheduler';

const mockDb = {
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  gte: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  update: vi.fn(),
};

function chain() {
  ['from','select','eq','in','gte','order','limit','update'].forEach(m => {
    (mockDb as any)[m].mockReturnValue(mockDb);
  });
}

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => mockDb),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

beforeEach(() => { vi.clearAllMocks(); chain(); });

describe('RnnScheduler', () => {
  describe('getOptimalPublishTime', () => {
    it('falls back when engagement_metrics table is missing', async () => {
      mockDb.limit.mockImplementationOnce(() => { throw new Error('no such table'); });
      const scheduler = new RnnScheduler();
      const result = await scheduler.getOptimalPublishTime('tiktok', 'hash');
      expect(result.source).toBe('fallback');
      expect(result.time).toBeInstanceOf(Date);
    });

    it('falls back when fewer than MIN_DATA_POINTS', async () => {
      mockDb.limit.mockImplementationOnce(() => ({ data: [{ hour_of_day: 20, avg_engagement: 100 }] }));
      const scheduler = new RnnScheduler();
      const result = await scheduler.getOptimalPublishTime('tiktok', 'hash');
      expect(result.source).toBe('fallback');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('uses RNN with enough data', async () => {
      mockDb.limit.mockImplementationOnce(() => ({ data: [
        { hour_of_day: 8, avg_engagement: 10 },
        { hour_of_day: 9, avg_engagement: 30 },
        { hour_of_day: 20, avg_engagement: 100 },
        { hour_of_day: 21, avg_engagement: 80 },
      ]}));
      const scheduler = new RnnScheduler();
      const result = await scheduler.getOptimalPublishTime('tiktok', 'hash');
      expect(result.source).toBe('rnn');
      expect(result.confidence).toBeCloseTo(1, 1);
      expect(result.time).toBeInstanceOf(Date);
    });
  });

  describe('recordPublish', () => {
    it('marks schedule as published', async () => {
      const scheduler = new RnnScheduler();
      await scheduler.recordPublish(42, 1700000000);
      expect(mockDb.from).toHaveBeenCalledWith('rnn_schedule');
      expect(mockDb.update).toHaveBeenCalledWith({ published_at: 1700000000, status: 'published' });
      expect(mockDb.eq).toHaveBeenCalledWith('id', 42);
    });

    it('does not throw on missing table', async () => {
      mockDb.update.mockImplementationOnce(() => { throw new Error('no such table'); });
      const scheduler = new RnnScheduler();
      await expect(scheduler.recordPublish(1, 0)).resolves.toBeUndefined();
    });
  });

  describe('getUpcomingSlots', () => {
    it('returns empty when count is 0', async () => {
      const scheduler = new RnnScheduler();
      expect(await scheduler.getUpcomingSlots('tiktok', 0)).toEqual([]);
    });

    it('returns upcoming slots in order', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      mockDb.limit.mockImplementationOnce(() => ({ data: [
        { optimal_time: nowSec + 3600 },
        { optimal_time: nowSec + 7200 },
      ]}));
      const scheduler = new RnnScheduler();
      const slots = await scheduler.getUpcomingSlots('tiktok', 5);
      expect(slots).toHaveLength(2);
      expect(slots[0].getTime()).toBeLessThan(slots[1].getTime());
    });

    it('respects count parameter', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      mockDb.limit.mockImplementationOnce(() => ({ data: [
        { optimal_time: nowSec + 3600 },
      ]}));
      const scheduler = new RnnScheduler();
      const slots = await scheduler.getUpcomingSlots('tiktok', 1);
      expect(slots).toHaveLength(1);
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('returns empty on table error', async () => {
      mockDb.limit.mockImplementationOnce(() => { throw new Error('no such table'); });
      const scheduler = new RnnScheduler();
      const slots = await scheduler.getUpcomingSlots('tiktok', 5);
      expect(slots).toEqual([]);
    });
  });
});
