import { describe, it, expect } from 'vitest';
import { scheduleRenderBatch } from '../render-batch-scheduler';

describe('Tree v14: Render Batch Scheduler', () => {
  it('prioritizes jobs with highest EV density and fits them into batch capacity', () => {
    const jobs = [
      {
        jobId: 'job-low-ev',
        deliberationScore: 60,
        kellyAllocationFraction: 0.1,
        estimatedMcuCost: 50, // EV = (0.1 * 60) / 50 = 0.12
      },
      {
        jobId: 'job-high-ev',
        deliberationScore: 90,
        kellyAllocationFraction: 0.3,
        estimatedMcuCost: 30, // EV = (0.3 * 90) / 30 = 0.90
      },
      {
        jobId: 'job-mid-ev',
        deliberationScore: 80,
        kellyAllocationFraction: 0.2,
        estimatedMcuCost: 40, // EV = (0.2 * 80) / 40 = 0.40
      },
    ];

    const result = scheduleRenderBatch(jobs, 75);

    expect(result.scheduledJobs).toHaveLength(2);
    expect(result.scheduledJobs[0].jobId).toBe('job-high-ev');
    expect(result.scheduledJobs[0].priorityRank).toBe(1);
    expect(result.scheduledJobs[1].jobId).toBe('job-mid-ev');
    expect(result.scheduledJobs[1].priorityRank).toBe(2);
    expect(result.totalAllocatedMcu).toBe(70);
    expect(result.remainingBatchBudget).toBe(5);
  });

  it('handles empty jobs or zero capacity gracefully', () => {
    const result = scheduleRenderBatch([], 100);
    expect(result.scheduledJobs).toHaveLength(0);
    expect(result.totalAllocatedMcu).toBe(0);
  });
});
