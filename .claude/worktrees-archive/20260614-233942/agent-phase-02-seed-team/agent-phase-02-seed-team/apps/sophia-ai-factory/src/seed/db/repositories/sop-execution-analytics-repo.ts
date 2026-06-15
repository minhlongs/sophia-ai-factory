/**
 * SOP Execution Analytics repository — public barrel re-export.
 *
 * Delegates to two focused sub-modules:
 *  - sop-execution-log-repo     — per-step log writes/reads
 *  - sop-execution-metrics-repo — aggregate metrics, ratings, performance queries
 *
 * @module seed/db/repositories/sop-execution-analytics-repo
 */

export type {
  SopExecutionLogRow,
  SopExecutionMetricsRow,
  SOPPerformanceSummary,
  CreatorPerformanceSummary,
} from '@/seed/db/repositories/sop-execution-analytics/types';

export {
  logStepExecution,
  getExecutionSteps,
} from '@/seed/db/repositories/sop-execution-analytics/sop-execution-log-repo';

export {
  logExecutionCompletion,
  rateExecution,
  getSOPPerformanceMetrics,
  getCreatorPerformanceMetrics,
} from '@/seed/db/repositories/sop-execution-analytics/sop-execution-metrics-repo';
