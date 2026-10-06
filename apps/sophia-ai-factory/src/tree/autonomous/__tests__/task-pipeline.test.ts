import { describe, expect, it } from 'vitest';
import type {
  AutonomousScheduleTaskRow,
  ScheduledTaskExecution,
} from '@/seed/types/autonomous-engine';
import {
  sortScheduleTasks,
  sortTasksByPriority,
  validatePipelineDependencies,
} from '../task-pipeline';

describe('Autonomous Task Pipeline Engine', () => {
  describe('sortTasksByPriority', () => {
    it('sorts tasks with highest priority first (1 > 2 > 3)', () => {
      const tasks: ScheduledTaskExecution[] = [
        {
          taskId: 't-scout',
          skillName: 'affiliate-scout',
          scheduledTime: 1000,
          attemptNumber: 0,
          payload: {},
          priority: 3,
        },
        {
          taskId: 't-publisher',
          skillName: 'auto-publisher',
          scheduledTime: 1000,
          attemptNumber: 0,
          payload: {},
          priority: 1,
        },
        {
          taskId: 't-producer',
          skillName: 'content-producer',
          scheduledTime: 1000,
          attemptNumber: 0,
          payload: {},
          priority: 2,
        },
      ];

      const sorted = sortTasksByPriority(tasks);
      expect(sorted.map((t) => t.skillName)).toEqual([
        'auto-publisher',
        'content-producer',
        'affiliate-scout',
      ]);
    });

    it('falls back to default skill priorities when priority property is omitted', () => {
      const tasks: ScheduledTaskExecution[] = [
        {
          taskId: 't-scout',
          skillName: 'affiliate-scout',
          scheduledTime: 1000,
          attemptNumber: 0,
          payload: {},
        },
        {
          taskId: 't-pub',
          skillName: 'auto-publisher',
          scheduledTime: 1000,
          attemptNumber: 0,
          payload: {},
        },
      ];

      const sorted = sortTasksByPriority(tasks);
      expect(sorted[0].skillName).toBe('auto-publisher');
      expect(sorted[1].skillName).toBe('affiliate-scout');
    });

    it('uses scheduledTime as secondary sort when priorities match', () => {
      const tasks: ScheduledTaskExecution[] = [
        {
          taskId: 't-later',
          skillName: 'affiliate-scout',
          scheduledTime: 2000,
          attemptNumber: 0,
          payload: {},
          priority: 3,
        },
        {
          taskId: 't-earlier',
          skillName: 'affiliate-scout',
          scheduledTime: 1000,
          attemptNumber: 0,
          payload: {},
          priority: 3,
        },
      ];

      const sorted = sortTasksByPriority(tasks);
      expect(sorted[0].taskId).toBe('t-earlier');
      expect(sorted[1].taskId).toBe('t-later');
    });
  });

  describe('sortScheduleTasks', () => {
    it('sorts database rows by priority then next_run_at', () => {
      const rows: AutonomousScheduleTaskRow[] = [
        {
          id: 'row-3',
          skill_name: 'affiliate-scout',
          schedule_type: 'interval',
          schedule_expression: null,
          interval_seconds: 14400,
          event_trigger: null,
          timezone: 'UTC',
          tier_requirement: 'PREMIUM',
          priority: 3,
          enabled: 1,
          last_run_at: null,
          next_run_at: 1000,
          run_count: 0,
          failure_count: 0,
          lock_token: null,
          locked_until: null,
          created_at: 0,
          updated_at: 0,
        },
        {
          id: 'row-1',
          skill_name: 'auto-publisher',
          schedule_type: 'event_driven',
          schedule_expression: null,
          interval_seconds: 300,
          event_trigger: 'video_ready',
          timezone: 'UTC',
          tier_requirement: 'ENTERPRISE',
          priority: 1,
          enabled: 1,
          last_run_at: null,
          next_run_at: 1000,
          run_count: 0,
          failure_count: 0,
          lock_token: null,
          locked_until: null,
          created_at: 0,
          updated_at: 0,
        },
      ];

      const sorted = sortScheduleTasks(rows);
      expect(sorted[0].id).toBe('row-1');
      expect(sorted[1].id).toBe('row-3');
    });
  });

  describe('validatePipelineDependencies', () => {
    it('identifies runnable vs blocked skills based on prerequisites', () => {
      // Without prerequisites, affiliate-scout is runnable (no deps),
      // while content-producer (needs affiliate-scout) is runnable once affiliate-scout is satisfied in sequential pipeline
      const skills = ['affiliate-scout', 'content-producer', 'auto-publisher'];
      const res = validatePipelineDependencies(skills, new Set());

      expect(res.runnable).toEqual([
        'affiliate-scout',
        'content-producer',
        'auto-publisher',
      ]);
      expect(res.blocked).toEqual([]);
    });

    it('blocks skills when mandatory upstream dependency is not present', () => {
      // Running content-producer alone without affiliate-scout available
      const skills = ['content-producer'];
      const res = validatePipelineDependencies(skills, new Set());

      expect(res.runnable).toEqual([]);
      expect(res.blocked).toEqual(['content-producer']);
      expect(res.missingDependencies['content-producer']).toEqual(['affiliate-scout']);
    });

    it('allows content-producer when affiliate-scout output is already satisfied', () => {
      const skills = ['content-producer'];
      const res = validatePipelineDependencies(skills, ['affiliate-scout']);

      expect(res.runnable).toEqual(['content-producer']);
      expect(res.blocked).toEqual([]);
    });
  });
});
