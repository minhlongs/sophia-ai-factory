/**
 * Backward-compatible facade for revenue attribution Inngest job.
 * @module forest/inngest/functions/revenue-attribution
 */

export { revenueAttribution } from './revenue-ops';
export type {
  UnattributedJobRow,
  PerformanceEventRow,
  AttributionProvenanceRow,
  AttributionCandidateWinner,
} from './revenue-ops';
