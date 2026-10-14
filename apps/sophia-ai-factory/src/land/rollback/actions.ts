/**
 * Server Actions for rollback operations.
 * Wraps tree-layer rollback functions with auth and workspace permission checks.
 * All functions return Result<T, E> — no thrown exceptions across action boundaries.
 *
 * @module land/rollback/actions
 */

'use server';

export {
  type RollbackActionError,
  rollbackMissionAction,
  getRollbackHistoryAction,
} from './actions-core/index';
