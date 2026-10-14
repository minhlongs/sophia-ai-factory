/**
 * Server Actions for creative mission lifecycle management.
 * Wraps tree-layer mission functions with auth and workspace permission checks.
 * All functions return Result<T, E> — no thrown exceptions across action boundaries.
 *
 * Layer: land — imports seed and tree only.
 *
 * @module land/creative-mission/actions
 */

// Types
export type {
  MissionError,
  MissionAction,
  ExecuteMultiTrackMissionInput,
} from './types';

// Lifecycle Actions
export {
  createMission,
  updateMissionStatus,
} from './actions/lifecycle-actions';

// Query Actions
export {
  listMissions,
  getMission,
  getMissionTrackStatus,
} from './actions/query-actions';

// Execution Actions
export {
  startMissionExecution,
} from './actions/execution-actions';

// Multi-track Actions
export {
  executeMultiTrackMissionAction,
} from './actions/multitrack-actions';

// Approval Actions
export {
  requestApproval,
  listPendingApprovalsAction,
} from './actions/approval-request-actions';

export {
  resolveApprovalAction,
} from './actions/approval-resolve-actions';
