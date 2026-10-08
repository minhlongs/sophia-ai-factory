/**
 * Tree Layer: Zero-Waste Render Batch Scheduler
 * Prioritizes pending video renders by Expected Value (EV) density to maximize GPU efficiency.
 * Layer: tree/growth-v14 | Max LOC: < 200 | Zero :any | Zero IO
 * @module tree/growth-v14/render-batch-scheduler
 */

export interface CandidateRenderJob {
  jobId: string;
  deliberationScore: number;
  kellyAllocationFraction: number;
  estimatedMcuCost: number;
}

export interface ScheduledRenderJob extends CandidateRenderJob {
  expectedValueScore: number;
  priorityRank: number;
}

export interface BatchScheduleResult {
  scheduledJobs: ScheduledRenderJob[];
  totalAllocatedMcu: number;
  remainingBatchBudget: number;
}

/**
 * Calculates Expected Value score per unit MCU:
 *   EV = (Kelly Fraction * Deliberation Score) / max(1, Estimated MCU)
 * Ranks jobs in descending order and fits as many as possible within maximum available MCU batch capacity.
 */
export function scheduleRenderBatch(
  candidateJobs: CandidateRenderJob[],
  maxBatchMcuCapacity: number
): BatchScheduleResult {
  if (candidateJobs.length === 0 || maxBatchMcuCapacity <= 0) {
    return {
      scheduledJobs: [],
      totalAllocatedMcu: 0,
      remainingBatchBudget: Math.max(0, maxBatchMcuCapacity),
    };
  }

  // Calculate EV score for each candidate
  const rankedCandidates = candidateJobs
    .map((job) => {
      const rawEv =
        (job.kellyAllocationFraction * job.deliberationScore) /
        Math.max(1, job.estimatedMcuCost);
      return {
        ...job,
        expectedValueScore: Number(rawEv.toFixed(5)),
        priorityRank: 0,
      };
    })
    .sort((a, b) => b.expectedValueScore - a.expectedValueScore);

  const scheduledJobs: ScheduledRenderJob[] = [];
  let totalAllocatedMcu = 0;

  for (let i = 0; i < rankedCandidates.length; i++) {
    const candidate = rankedCandidates[i];
    if (totalAllocatedMcu + candidate.estimatedMcuCost <= maxBatchMcuCapacity) {
      totalAllocatedMcu += candidate.estimatedMcuCost;
      scheduledJobs.push({
        ...candidate,
        priorityRank: scheduledJobs.length + 1,
      });
    }
  }

  return {
    scheduledJobs,
    totalAllocatedMcu,
    remainingBatchBudget: maxBatchMcuCapacity - totalAllocatedMcu,
  };
}
