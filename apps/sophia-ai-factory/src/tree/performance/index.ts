/**
 * Performance & Experiment primitives — barrel export
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/performance
 */

export { PerformanceError } from './errors';
export type { PerformanceErrorCode } from './errors';

export {
  newPerformanceEventId,
  recordPerformanceEvent,
  getPerformanceEvents,
  performanceRowToDomain,
  performanceDomainToRow,
} from './events';

export {
  newExperimentId,
  createExperiment,
  getExperiment,
  listExperiments,
  startExperiment,
  completeExperiment,
  recordExperimentResult,
  getExperimentResults,
  experimentRowToDomain,
  variantRowToDomain,
  resultRowToDomain,
  isValidTransition,
} from './experiment';

export type { ExperimentResult } from './experiment';