import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
  isOffPeakNow,
  calculateNextOffPeakStartSec,
  enqueueComputeJob,
  leasePendingJobs,
  coordinateBatchQueue,
  updateJobStatus,
  type ComputeJobRow,
} from '../opportunistic-scheduler';

describe('Opportunistic Scheduler (Forest Layer)', () => {
  let mockDbRows: ComputeJobRow[] = [];

  const createMockDb = (): D1Database => {
    return {
      prepare: vi.fn((sql: string) => {
        return {
          bind: vi.fn((...params: unknown[]) => {
            return {
              run: vi.fn(async () => {
                const normalizedSql = sql.replace(/\s+/g, ' ').trim().toUpperCase();
                if (normalizedSql.startsWith('INSERT INTO GROWTH_V11_COMPUTE_JOBS')) {
                  const existingIdx = mockDbRows.findIndex((r) => r.job_id === params[1]);
                  const row: ComputeJobRow = {
                    id: String(params[0]),
                    job_id: String(params[1]),
                    video_id: String(params[2]),
                    user_tier: String(params[3]),
                    velocity_score: Number(params[4]),
                    priority: String(params[5]),
                    target_model_tier: String(params[6]),
                    earliest_execution_sec: Number(params[7]),
                    latest_execution_sec: Number(params[8]),
                    is_off_peak: Number(params[9]),
                    estimated_cost_usd: Number(params[10]),
                    estimated_savings_usd: Number(params[11]),
                    discount_ratio: Number(params[12]),
                    status: String(params[13]),
                    created_at: Number(params[14]),
                    updated_at: Number(params[15]),
                  };
                  if (existingIdx >= 0) {
                    mockDbRows[existingIdx] = row;
                  } else {
                    mockDbRows.push(row);
                  }
                  return { success: true, meta: { changes: 1 } };
                }

                if (normalizedSql.startsWith('UPDATE GROWTH_V11_COMPUTE_JOBS')) {
                  if (normalizedSql.includes("STATUS = 'LEASED'")) {
                    const rowId = params[1] as string;
                    const row = mockDbRows.find((r) => r.id === rowId);
                    if (row) {
                      row.status = 'LEASED';
                      row.updated_at = Number(params[0]);
                      return { success: true, meta: { changes: 1 } };
                    }
                  } else if (normalizedSql.includes("STATUS = 'DISPATCHED'")) {
                    const jobId = params[1] as string;
                    const row = mockDbRows.find((r) => r.job_id === jobId);
                    if (row) {
                      row.status = 'DISPATCHED';
                      row.updated_at = Number(params[0]);
                      return { success: true, meta: { changes: 1 } };
                    }
                  } else if (normalizedSql.includes("STATUS = 'PENDING'")) {
                    let changes = 0;
                    for (const r of mockDbRows) {
                      if (r.status === 'QUEUED' && r.is_off_peak === 1) {
                        r.status = 'PENDING';
                        r.updated_at = Number(params[0]);
                        changes++;
                      }
                    }
                    return { success: true, meta: { changes } };
                  } else {
                    const newStatus = params[0] as string;
                    const jobId = params[2] as string;
                    const row = mockDbRows.find((r) => r.job_id === jobId);
                    if (row) {
                      row.status = newStatus;
                      row.updated_at = Number(params[1]);
                      return { success: true, meta: { changes: 1 } };
                    }
                  }
                }
                return { success: true, meta: { changes: 0 } };
              }),
              all: vi.fn(async () => {
                return { results: [...mockDbRows], success: true };
              }),
              first: vi.fn(async () => {
                const normalizedSql = sql.replace(/\s+/g, ' ').trim().toUpperCase();
                if (normalizedSql.includes('COUNT(*)')) {
                  const queuedCount = mockDbRows.filter((r) => r.status === 'QUEUED').length;
                  return { count: queuedCount };
                }
                const jobId = params[0] as string;
                return mockDbRows.find((r) => r.job_id === jobId) || null;
              }),
            };
          }),
        };
      }) as unknown as D1Database['prepare'],
    } as unknown as D1Database;
  };

  beforeEach(() => {
    mockDbRows = [];
  });

  describe('UTC Off-Peak Windows & Times', () => {
    it('accurately identifies off-peak vs peak hours', () => {
      // 03:00 UTC is off-peak
      const offPeakDate = new Date('2026-10-08T03:00:00Z');
      expect(isOffPeakNow(offPeakDate)).toBe(true);

      // 14:00 UTC is peak
      const peakDate = new Date('2026-10-08T14:00:00Z');
      expect(isOffPeakNow(peakDate)).toBe(false);
    });

    it('calculates the next off-peak start seconds accurately', () => {
      // At 14:00 UTC today, next off-peak is 02:00 UTC tomorrow
      const peakDate = new Date('2026-10-08T14:00:00Z');
      const nextOffPeakSec = calculateNextOffPeakStartSec(peakDate);
      const expectedDate = new Date('2026-10-09T02:00:00Z');
      expect(nextOffPeakSec).toBe(Math.floor(expectedDate.getTime() / 1000));

      // At 01:00 UTC today, next off-peak is 02:00 UTC today
      const earlyDate = new Date('2026-10-08T01:00:00Z');
      const earlyNextSec = calculateNextOffPeakStartSec(earlyDate);
      const earlyExpected = new Date('2026-10-08T02:00:00Z');
      expect(earlyNextSec).toBe(Math.floor(earlyExpected.getTime() / 1000));
    });
  });

  describe('enqueueComputeJob', () => {
    it('validates required fields', async () => {
      const db = createMockDb();
      const res = await enqueueComputeJob(db, {
        jobId: '',
        videoId: '',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('INVALID_INPUT');
      }
    });

    it('immediately dispatches high-velocity renders as PENDING', async () => {
      const db = createMockDb();
      const res = await enqueueComputeJob(db, {
        jobId: 'job_high_vel',
        videoId: 'vid_123',
        velocityScore: 92,
        currentDate: new Date('2026-10-08T15:00:00Z'), // peak hour
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.status).toBe('PENDING');
        expect(res.value.priority).toBe('IMMEDIATE_PREMIUM');
        expect(res.value.targetModelTier).toBe('PHOTOREAL_EXPENSIVE');
      }
    });

    it('queues low-priority renders for off-peak execution when requested outside off-peak', async () => {
      const db = createMockDb();
      const res = await enqueueComputeJob(db, {
        jobId: 'job_low_priority',
        videoId: 'vid_456',
        velocityScore: 40,
        priority: 'OFF_PEAK_ECONOMIC',
        currentDate: new Date('2026-10-08T15:00:00Z'), // peak hour
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.status).toBe('QUEUED');
        expect(res.value.isOffPeak).toBe(true);
        expect(res.value.discountRatio).toBe(0.42);
      }
    });

    it('immediately marks low-priority renders as PENDING if already in off-peak window', async () => {
      const db = createMockDb();
      const res = await enqueueComputeJob(db, {
        jobId: 'job_offpeak_window',
        videoId: 'vid_789',
        velocityScore: 40,
        priority: 'OFF_PEAK_ECONOMIC',
        currentDate: new Date('2026-10-08T04:00:00Z'), // off-peak hour
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.status).toBe('PENDING');
      }
    });
  });

  describe('leasePendingJobs & coordinateBatchQueue', () => {
    it('atomically leases pending jobs and dispatches high-velocity jobs', async () => {
      const db = createMockDb();
      // Setup mock pending jobs
      mockDbRows = [
        {
          id: 'row_1',
          job_id: 'job_1',
          video_id: 'v_1',
          user_tier: 'MASTER',
          velocity_score: 95,
          priority: 'IMMEDIATE_PREMIUM',
          target_model_tier: 'PHOTOREAL_EXPENSIVE',
          earliest_execution_sec: 1000,
          latest_execution_sec: 90000,
          is_off_peak: 0,
          estimated_cost_usd: 6.0,
          estimated_savings_usd: 0,
          discount_ratio: 0,
          status: 'PENDING',
          created_at: 1000,
          updated_at: 1000,
        },
        {
          id: 'row_2',
          job_id: 'job_2',
          video_id: 'v_2',
          user_tier: 'BASIC',
          velocity_score: 30,
          priority: 'OFF_PEAK_ECONOMIC',
          target_model_tier: 'ECONOMY_DEGRADED',
          earliest_execution_sec: 2000,
          latest_execution_sec: 90000,
          is_off_peak: 1,
          estimated_cost_usd: 1.0,
          estimated_savings_usd: 0.42,
          discount_ratio: 0.42,
          status: 'QUEUED',
          created_at: 1000,
          updated_at: 1000,
        },
      ];

      // Coordinate during off-peak window
      const coordResult = await coordinateBatchQueue(db, {
        currentDate: new Date('2026-10-08T05:00:00Z'),
        batchLimit: 10,
      });

      expect(coordResult.ok).toBe(true);
      if (coordResult.ok) {
        expect(coordResult.value.isOffPeak).toBe(true);
        expect(coordResult.value.promotedCount).toBe(1);
        expect(coordResult.value.dispatchedCount).toBeGreaterThan(0);
      }
    });

    it('updates job status correctly', async () => {
      const db = createMockDb();
      mockDbRows = [
        {
          id: 'row_10',
          job_id: 'job_10',
          video_id: 'v_10',
          user_tier: 'PREMIUM',
          velocity_score: 80,
          priority: 'IMMEDIATE_PREMIUM',
          target_model_tier: 'PHOTOREAL_EXPENSIVE',
          earliest_execution_sec: 1000,
          latest_execution_sec: 90000,
          is_off_peak: 0,
          estimated_cost_usd: 5.0,
          estimated_savings_usd: 0,
          discount_ratio: 0,
          status: 'LEASED',
          created_at: 1000,
          updated_at: 1000,
        },
      ];

      const res = await updateJobStatus(db, 'job_10', 'COMPLETED');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.status).toBe('COMPLETED');
      }
    });
  });
});
