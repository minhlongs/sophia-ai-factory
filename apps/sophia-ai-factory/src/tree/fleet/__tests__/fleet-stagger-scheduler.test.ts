/**
 * @file fleet-stagger-scheduler.test.ts
 * @description Unit tests for Fleet Stagger Scheduler
 */

import { describe, it, expect } from 'vitest';
import { buildStaggerSchedule } from '../fleet-stagger-scheduler';
import type { FleetCreatorAccount } from '@/seed/types/fleet-matrix-sku-radar-types';

describe('Fleet Stagger Scheduler', () => {
  const mockAccounts: FleetCreatorAccount[] = [
    {
      id: 'acc-1',
      userId: 'usr-1',
      platform: 'TIKTOK',
      handle: '@tech_guru',
      displayName: 'Tech Guru',
      avatarUrl: null,
      proxyConfigId: 'prx-1',
      status: 'ACTIVE',
      dailyPostLimit: 3,
      postsPublishedToday: 1,
      lastPostAt: 1700000000,
      totalViews: 50000,
      totalClicks: 2000,
      totalGmv: 15000000,
      totalCommission: 3000000,
      createdAt: 1690000000,
      updatedAt: 1700000000,
    },
    {
      id: 'acc-2',
      userId: 'usr-1',
      platform: 'YOUTUBE',
      handle: '@shorts_master',
      displayName: 'Shorts Master',
      avatarUrl: null,
      proxyConfigId: 'prx-2',
      status: 'ACTIVE',
      dailyPostLimit: 4,
      postsPublishedToday: 2,
      lastPostAt: 1700000000,
      totalViews: 120000,
      totalClicks: 4500,
      totalGmv: 35000000,
      totalCommission: 7000000,
      createdAt: 1690000000,
      updatedAt: 1700000000,
    },
    {
      id: 'acc-3_maxed',
      userId: 'usr-1',
      platform: 'INSTAGRAM',
      handle: '@reels_queen',
      displayName: 'Reels Queen',
      avatarUrl: null,
      proxyConfigId: 'prx-3',
      status: 'ACTIVE',
      dailyPostLimit: 2,
      postsPublishedToday: 2, // Reached limit
      lastPostAt: 1700000000,
      totalViews: 80000,
      totalClicks: 3000,
      totalGmv: 20000000,
      totalCommission: 4000000,
      createdAt: 1690000000,
      updatedAt: 1700000000,
    },
    {
      id: 'acc-4_suspended',
      userId: 'usr-1',
      platform: 'TIKTOK',
      handle: '@banned_acc',
      displayName: 'Banned Account',
      avatarUrl: null,
      proxyConfigId: 'prx-4',
      status: 'SUSPENDED',
      dailyPostLimit: 3,
      postsPublishedToday: 0,
      lastPostAt: null,
      totalViews: 1000,
      totalClicks: 50,
      totalGmv: 0,
      totalCommission: 0,
      createdAt: 1690000000,
      updatedAt: 1700000000,
    },
  ];

  it('skips accounts that are suspended or reached their daily post limit', () => {
    const plan = buildStaggerSchedule({
      deploymentId: 'dep-101',
      accounts: mockAccounts,
      hookCount: 3,
      baseIntervalMinutes: 30,
      startTimeMs: 1700000000000,
    });

    expect(plan.skippedAccounts).toContain('acc-3_maxed');
    expect(plan.skippedAccounts).toContain('acc-4_suspended');
    expect(plan.totalScheduled).toBe(2);
  });

  it('calculates staggered delay with anti-detection intervals', () => {
    const plan = buildStaggerSchedule({
      deploymentId: 'dep-102',
      accounts: mockAccounts,
      hookCount: 2,
      baseIntervalMinutes: 30,
      startTimeMs: 1700000000000,
      jitterSeed: 123,
    });

    expect(plan.schedule[0].delayMinutesFromStart).toBe(0);
    expect(plan.schedule[1].delayMinutesFromStart).toBeGreaterThanOrEqual(5);
    expect(plan.schedule[0].assignedHookIndex).toBe(0);
    expect(plan.schedule[1].assignedHookIndex).toBe(1);
    expect(plan.estimatedTotalDurationMinutes).toBe(plan.schedule[1].delayMinutesFromStart);
  });
});
