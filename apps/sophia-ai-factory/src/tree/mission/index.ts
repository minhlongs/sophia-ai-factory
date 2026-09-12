/**
 * Mission lifecycle — barrel export
 * @module tree/mission
 */

export {
  createMission,
  getMission,
  getMissionWithGoals,
  listMissions,
  updateMissionStatus,
  recordSpend,
  deleteMission,
  canTransition,
  newMissionId,
  getMissionMetrics,
} from './types';

export {
  EXECUTION_START_FROM,
  canStartExecution,
  beginMissionExecution,
} from './types';

export {
  createGoal,
  getGoalsByMission,
  getGoalsByWorkspace,
  updateGoalProgress,
  deleteGoal,
  newGoalId,
} from './goal';

export {
  createAgentRun,
  getAgentRun,
  updateAgentRun,
  appendAgentLog,
  createApproval,
  getApproval,
  resolveApproval,
  listPendingApprovals,
} from './agent-run-repo';

export {
  runMissionPreflightCheck,
  MAX_SINGLE_MISSION_COST_CENTS,
} from './preflight-check';

export type {
  PreflightGateCheck,
  MissionPreflightChecklist,
  MissionPreflightResult,
  MissionPreflightOptions,
} from './preflight-check';

export type { PendingApprovalRecord } from './agent-run-repo';

export type { MissionError } from './types';
export type { GoalError } from './goal';
