/**
 * @file fleet-stagger-scheduler.ts
 * @description Anti-Shadowban Multi-Account Staggered Publishing Scheduler
 * @layer tree
 */

import type { FleetCreatorAccount } from '@/seed/types/fleet-matrix-sku-radar-types';

export interface StaggerScheduleItem {
  accountId: string;
  platform: FleetCreatorAccount['platform'];
  handle: string;
  scheduledTimeMs: number;
  delayMinutesFromStart: number;
  assignedHookIndex: number;
}

export interface StaggerSchedulePlan {
  deploymentId: string;
  totalScheduled: number;
  skippedAccounts: string[];
  schedule: StaggerScheduleItem[];
  estimatedTotalDurationMinutes: number;
}

export interface BuildStaggerScheduleInput {
  deploymentId: string;
  accounts: FleetCreatorAccount[];
  hookCount: number;
  baseIntervalMinutes?: number;
  startTimeMs?: number;
  jitterSeed?: number;
}

/**
 * Deterministic pseudo-jitter within [-5, +10] minutes
 */
function computeJitterMinutes(index: number, seed: number): number {
  const pseudoRandom = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  const fractional = pseudoRandom - Math.floor(pseudoRandom);
  return Math.floor(fractional * 15) - 5;
}

export function buildStaggerSchedule(input: BuildStaggerScheduleInput): StaggerSchedulePlan {
  const baseInterval = Math.max(5, input.baseIntervalMinutes ?? 30);
  const startTime = input.startTimeMs ?? Date.now();
  const seed = input.jitterSeed ?? 42;

  const schedule: StaggerScheduleItem[] = [];
  const skippedAccounts: string[] = [];

  let accumulatedDelayMinutes = 0;

  input.accounts.forEach((acc, index) => {
    // Skip suspended accounts or accounts that reached daily limit
    if (acc.status === 'SUSPENDED' || acc.postsPublishedToday >= acc.dailyPostLimit) {
      skippedAccounts.push(acc.id);
      return;
    }

    const jitter = computeJitterMinutes(index, seed);
    const intervalWithJitter = Math.max(5, baseInterval + jitter);

    if (schedule.length > 0) {
      accumulatedDelayMinutes += intervalWithJitter;
    }

    const scheduledTimeMs = startTime + accumulatedDelayMinutes * 60 * 1000;
    const assignedHookIndex = input.hookCount > 0 ? schedule.length % input.hookCount : 0;

    schedule.push({
      accountId: acc.id,
      platform: acc.platform,
      handle: acc.handle,
      scheduledTimeMs,
      delayMinutesFromStart: accumulatedDelayMinutes,
      assignedHookIndex,
    });
  });

  return {
    deploymentId: input.deploymentId,
    totalScheduled: schedule.length,
    skippedAccounts,
    schedule,
    estimatedTotalDurationMinutes: accumulatedDelayMinutes,
  };
}
