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

export type { PendingApprovalRecord } from './agent-run-repo';

export type { MissionError } from './types';
export type { GoalError } from './goal';