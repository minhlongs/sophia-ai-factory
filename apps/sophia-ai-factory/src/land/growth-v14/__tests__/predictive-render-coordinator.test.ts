import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPredictiveRenderJob,
  updateJobStatusInD1,
  getJobsForUser,
} from '../predictive-render-coordinator';
import * as clientModule from '@/seed/db/client';

describe('Land v14: Predictive Render Coordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists a new predictive render job in D1', async () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockDb = { prepare: mockPrepare };

    vi.spyOn(clientModule, 'getD1').mockResolvedValue(mockDb as unknown as D1Database);

    const job = await createPredictiveRenderJob({
      id: 'job-101',
      userId: 'usr-1',
      scriptId: 'scr-1',
      deliberationScore: 85,
      kellyAllocationFraction: 0.25,
      allocatedMcu: 250,
    });

    expect(job).not.toBeNull();
    expect(job?.id).toBe('job-101');
    expect(job?.status).toBe('QUEUED');
    expect(mockPrepare).toHaveBeenCalled();
  });

  it('updates the status and halt parameters of a job', async () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockDb = { prepare: mockPrepare };

    vi.spyOn(clientModule, 'getD1').mockResolvedValue(mockDb as unknown as D1Database);

    const success = await updateJobStatusInD1(
      'job-101',
      'HALTED_EARLY',
      50,
      0.15,
      'Retention percentile below cutoff'
    );

    expect(success).toBe(true);
    expect(mockBind).toHaveBeenCalled();
  });

  it('retrieves user predictive render jobs mapped to TypeScript objects', async () => {
    const mockRows = [
      {
        id: 'job-101',
        user_id: 'usr-1',
        script_id: 'scr-1',
        mab_arm_id: 'arm-1',
        deliberation_score: 90,
        kelly_allocation_fraction: 0.3,
        allocated_mcu: 300,
        actual_mcu_consumed: 300,
        status: 'COMPLETED',
        early_halt_probability: 0.85,
        halt_reason: null,
        created_at: 1000,
        updated_at: 2000,
      },
    ];

    const mockAll = vi.fn().mockResolvedValue({ results: mockRows });
    const mockBind = vi.fn().mockReturnValue({ all: mockAll });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockDb = { prepare: mockPrepare };

    vi.spyOn(clientModule, 'getD1').mockResolvedValue(mockDb as unknown as D1Database);

    const jobs = await getJobsForUser('usr-1');

    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe('job-101');
    expect(jobs[0].deliberationScore).toBe(90);
    expect(jobs[0].status).toBe('COMPLETED');
  });
});
