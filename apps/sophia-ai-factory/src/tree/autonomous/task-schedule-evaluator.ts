/**
 * Autonomous Schedule Task Due & Interval Evaluator
 *
 * Layer: tree/autonomous
 *
 * @module tree/autonomous/task-schedule-evaluator
 */

import type { AutonomousScheduleTaskRow } from '@/seed/types/autonomous-engine';
import { isCronDue } from './cron-evaluator';

/**
 * Calculates next interval run date.
 */
export function calculateNextIntervalRun(
  intervalSeconds: number,
  fromDate: Date = new Date()
): Date {
  return new Date(fromDate.getTime() + intervalSeconds * 1000);
}

/**
 * Determines whether a schedule task row is currently due for execution.
 *
 * @param task The task row from autonomous_schedule_tasks
 * @param nowMs Current epoch time in milliseconds
 */
export function isTaskDue(
  task: AutonomousScheduleTaskRow,
  nowMs: number = Date.now()
): boolean {
  if (!task.enabled || task.enabled === 0) {
    return false;
  }

  const nowSec = Math.floor(nowMs / 1000);

  // If task has an active lease lock that has not expired, it is not due
  if (task.locked_until !== null && task.locked_until > nowSec) {
    return false;
  }

  // If next_run_at is explicitly set and has been reached, task is due
  if (task.next_run_at !== null && task.next_run_at <= nowSec) {
    return true;
  }

  switch (task.schedule_type) {
    case 'interval': {
      if (task.last_run_at === null) {
        return true;
      }
      const interval = task.interval_seconds ?? 300;
      return nowSec - task.last_run_at >= interval;
    }

    case 'cron': {
      if (!task.schedule_expression) {
        return false;
      }
      return isCronDue(
        task.schedule_expression,
        new Date(nowMs),
        task.timezone || 'UTC'
      );
    }

    case 'event_driven': {
      return false;
    }

    default:
      return false;
  }
}
