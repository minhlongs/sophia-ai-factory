import { describe, expect, it } from 'vitest';
import type { AutonomousScheduleTaskRow } from '@/seed/types/autonomous-engine';
import {
  calculateNextCronRun,
  isCronDue,
  isTaskDue,
  parseCronExpression,
} from '../cron-evaluator';

describe('Autonomous Edge Cron & Schedule Evaluator', () => {
  describe('parseCronExpression', () => {
    it('parses standard 5-field daily expression (0 6 * * *)', () => {
      const rules = parseCronExpression('0 6 * * *');
      expect(rules.minute).toEqual([0]);
      expect(rules.hour).toEqual([6]);
      expect(rules.dayOfMonth.length).toBe(31);
      expect(rules.month.length).toBe(12);
      expect(rules.dayOfWeek.length).toBe(7);
    });

    it('parses step expressions like */15 for minutes', () => {
      const rules = parseCronExpression('*/15 * * * *');
      expect(rules.minute).toEqual([0, 15, 30, 45]);
    });

    it('parses lists and ranges in hours and days', () => {
      const rules = parseCronExpression('30 9-17,20 * * 1-5');
      expect(rules.minute).toEqual([30]);
      expect(rules.hour).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 20]);
      expect(rules.dayOfWeek).toEqual([1, 2, 3, 4, 5]);
    });

    it('normalizes day-of-week 7 to 0 (Sunday)', () => {
      const rules = parseCronExpression('0 0 * * 7');
      expect(rules.dayOfWeek).toEqual([0]);
    });

    it('throws error on expressions with fewer or more than 5 fields', () => {
      expect(() => parseCronExpression('* * * *')).toThrowError(/expected 5 fields/);
      expect(() => parseCronExpression('* * * * * *')).toThrowError(/expected 5 fields/);
    });

    it('throws error on out-of-range field values', () => {
      expect(() => parseCronExpression('65 * * * *')).toThrowError(/out of bounds/);
      expect(() => parseCronExpression('* 25 * * *')).toThrowError(/out of bounds/);
      expect(() => parseCronExpression('* * 0 * *')).toThrowError(/out of bounds/);
      expect(() => parseCronExpression('* * * 13 *')).toThrowError(/out of bounds/);
    });

    it('throws error on invalid step values', () => {
      expect(() => parseCronExpression('*/0 * * * *')).toThrowError(/Invalid step value/);
      expect(() => parseCronExpression('*/-5 * * * *')).toThrowError(/Invalid step value/);
    });
  });

  describe('isCronDue', () => {
    it('returns true when current minute and hour match in UTC', () => {
      const date = new Date('2026-10-06T06:00:00.000Z');
      expect(isCronDue('0 6 * * *', date, 'UTC')).toBe(true);
    });

    it('returns false when minute does not match', () => {
      const date = new Date('2026-10-06T06:01:00.000Z');
      expect(isCronDue('0 6 * * *', date, 'UTC')).toBe(false);
    });

    it('evaluates correctly across timezones (Asia/Ho_Chi_Minh UTC+7)', () => {
      // 13:00 in Vietnam (UTC+7) is 06:00 UTC
      const date = new Date('2026-10-06T06:00:00.000Z');
      // When checking against a cron written in local Vietnam time: "0 13 * * *"
      expect(isCronDue('0 13 * * *', date, 'Asia/Ho_Chi_Minh')).toBe(true);
      expect(isCronDue('0 6 * * *', date, 'Asia/Ho_Chi_Minh')).toBe(false);
    });
  });

  describe('calculateNextCronRun', () => {
    it('calculates the next daily run occurrence', () => {
      const from = new Date('2026-10-06T05:30:00.000Z');
      const next = calculateNextCronRun('0 6 * * *', from, 'UTC');
      expect(next.toISOString()).toBe('2026-10-06T06:00:00.000Z');
    });

    it('rolls over to next day when current time is past schedule', () => {
      const from = new Date('2026-10-06T06:30:00.000Z');
      const next = calculateNextCronRun('0 6 * * *', from, 'UTC');
      expect(next.toISOString()).toBe('2026-10-07T06:00:00.000Z');
    });

    it('calculates next 15-minute step run correctly', () => {
      const from = new Date('2026-10-06T10:04:12.000Z');
      const next = calculateNextCronRun('*/15 * * * *', from, 'UTC');
      expect(next.toISOString()).toBe('2026-10-06T10:15:00.000Z');
    });
  });

  describe('isTaskDue', () => {
    const baseTask: AutonomousScheduleTaskRow = {
      id: 'task-1',
      skill_name: 'affiliate-scout',
      schedule_type: 'interval',
      schedule_expression: null,
      interval_seconds: 14400, // 4 hours
      event_trigger: null,
      timezone: 'UTC',
      tier_requirement: 'PREMIUM',
      priority: 3,
      enabled: 1,
      last_run_at: 1000,
      next_run_at: null,
      run_count: 5,
      failure_count: 0,
      lock_token: null,
      locked_until: null,
      created_at: 1000,
      updated_at: 1000,
    };

    it('returns false if task is disabled', () => {
      const task = { ...baseTask, enabled: 0 };
      expect(isTaskDue(task, 20_000_000_000)).toBe(false);
    });

    it('returns false if task is actively leased by another execution', () => {
      const nowMs = 10_000_000;
      const task: AutonomousScheduleTaskRow = {
        ...baseTask,
        locked_until: Math.floor(nowMs / 1000) + 120, // leased for another 2 minutes
      };
      expect(isTaskDue(task, nowMs)).toBe(false);
    });

    it('returns true if next_run_at is reached', () => {
      const nowMs = 10_000_000;
      const task: AutonomousScheduleTaskRow = {
        ...baseTask,
        next_run_at: Math.floor(nowMs / 1000) - 10,
      };
      expect(isTaskDue(task, nowMs)).toBe(true);
    });

    it('evaluates interval tasks based on elapsed seconds since last_run_at', () => {
      const lastRunSec = 1000;
      const intervalSec = 3600; // 1 hour
      const task: AutonomousScheduleTaskRow = {
        ...baseTask,
        last_run_at: lastRunSec,
        interval_seconds: intervalSec,
      };

      // 3599 seconds later -> false
      expect(isTaskDue(task, (lastRunSec + 3599) * 1000)).toBe(false);
      // 3600 seconds later -> true
      expect(isTaskDue(task, (lastRunSec + 3600) * 1000)).toBe(true);
    });

    it('evaluates interval tasks as due if never run before (last_run_at is null)', () => {
      const task: AutonomousScheduleTaskRow = {
        ...baseTask,
        last_run_at: null,
      };
      expect(isTaskDue(task, Date.now())).toBe(true);
    });

    it('evaluates cron tasks via schedule_expression', () => {
      const task: AutonomousScheduleTaskRow = {
        ...baseTask,
        schedule_type: 'cron',
        schedule_expression: '0 6 * * *',
        next_run_at: null,
      };

      const matchDate = new Date('2026-10-06T06:00:00.000Z').getTime();
      const mismatchDate = new Date('2026-10-06T06:05:00.000Z').getTime();

      expect(isTaskDue(task, matchDate)).toBe(true);
      expect(isTaskDue(task, mismatchDate)).toBe(false);
    });
  });
});
