/**
 * Autonomy Level Enforcement — barrel export
 * @module forest/autonomy
 */

export {
  AutonomyError,
  AUTONOMY_LEVELS,
  getAutonomyLevelDescriptor,
  requiresApproval,
  checkPermission,
} from './types';
export type { AutonomyErrorCode, AutonomyLevelDescriptor } from './types';
