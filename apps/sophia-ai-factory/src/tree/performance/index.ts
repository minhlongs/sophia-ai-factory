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

// ─── Reality Loop v1 canonical emitters (Phase C) ────────────────────────────

export {
  classifyAutonomyFailure,
  loopEventId,
  type RealityLoopEventType,
  type AutonomyFailureClass,
  type LoopEventContext,
} from './loop-events';

export {
  emitMissionCreated,
  emitMissionAbandoned,
  emitAgentStarted,
  emitAgentFailed,
  emitApprovalRequested,
  emitApprovalApproved,
  emitApprovalRejected,
} from './loop-emitters-runner';

export {
  emitCreativeAccepted,
  emitCreativeEdited,
  emitCreativeRejected,
} from './loop-emitters-creative';

export {
  emitMemoryUsed,
  emitMemoryCorrected,
  emitMissionCostRecorded,
} from './loop-emitters-cost';