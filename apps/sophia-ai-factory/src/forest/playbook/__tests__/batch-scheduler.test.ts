/**
 * Batch Scheduler Unit Tests — Phase 5 Auto-Creative Playbook
 * Layer: forest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processRecurringCampaignBatch } from '../batch-scheduler';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  mockCreateServerClient: vi.fn(),
  mockGetUserTier: vi.fn(),
  mockCheckMissionQuota: vi.fn(),
  mockRunMissionPreflightCheck: vi.fn(),
  mockDeductCredits: vi.fn(),
  mockCreateMission: vi.fn(),
  mockDispatchMultiTrackMission: vi.fn(),
  mockGenerateCampaignBlueprint: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
  createServerClient: mocks.mockCreateServerClient,
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: mocks.mockGetUserTier,
}));

vi.mock('@/forest/quota/mission-quota', () => ({
  checkMissionQuota: mocks.mockCheckMissionQuota,
}));

vi.mock('@/tree/mission/preflight-check', () => ({
  runMissionPreflightCheck: mocks.mockRunMissionPreflightCheck,
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  deductCredits: mocks.mockDeductCredits,
}));

vi.mock('@/tree/mission/repository', () => ({
  createMission: mocks.mockCreateMission,
}));

vi.mock('@/tree/mission/executor-bridge', () => ({
  dispatchMultiTrackMission: mocks.mockDispatchMultiTrackMission,
}));

vi.mock('../campaign-generator', () => ({
  generateCampaignBlueprint: mocks.mockGenerateCampaignBlueprint,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Recurring Campaign Batch Scheduler — src/forest/playbook/batch-scheduler', () => {
  const TODAY = '2026-09-19';
  const USER_ID = 'usr_batch_test_1';
  const WS_ID = 'ws_batch_test_1';

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mockGetUserTier.mockResolvedValue('PREMIUM');
    mocks.mockCheckMissionQuota.mockResolvedValue({
      allowed: true,
      used: 5,
      limit: 100,
      resetAt: '2026-10-01T00:00:00.000Z',
    });
    mocks.mockGenerateCampaignBlueprint.mockResolvedValue({
      id: 'bp_123',
      workspaceId: WS_ID,
      name: { en: 'Affiliate Campaign', vi: 'Chiến Dịch Tiếp Thị' },
      description: { en: 'Test', vi: 'Thử nghiệm' },
      targetPlatform: 'tiktok',
      hookStyle: 'curiosity_gap',
      voiceStyle: 'dynamic_hook',
      durationSeconds: 25,
      aspectRatio: '9:16',
      estimatedScenes: 3,
      suggestedPrompts: [{ en: 'Prompt', vi: 'Lời nhắc' }],
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      estimatedCostCents: 150,
      targetChannels: ['tiktok'],
      sourcePatternIds: [],
    });
    mocks.mockRunMissionPreflightCheck.mockResolvedValue({
      passed: true,
      gates: {
        auth: { passed: true, code: 'AUTH_OK', message: 'OK' },
        ownership: { passed: true, code: 'OWNERSHIP_OK', message: 'OK' },
        entitlement: { passed: true, code: 'ENTITLEMENT_OK', message: 'OK' },
        credential: { passed: true, code: 'CREDENTIAL_OK', message: 'OK' },
        capability: { passed: true, code: 'CAPABILITY_OK', message: 'OK' },
        storage: { passed: true, code: 'STORAGE_OK', message: 'OK' },
        queue: { passed: true, code: 'QUEUE_OK', message: 'OK' },
      },
    });
    mocks.mockCreateMission.mockImplementation(async (m) => ({
      ...m,
      id: m.id || 'm_created_1',
    }));
    mocks.mockDeductCredits.mockResolvedValue(true);
    mocks.mockDispatchMultiTrackMission.mockResolvedValue({
      success: true,
      missionId: 'm_created_1',
    });
  });

  it('1. successfully processes and dispatches active due recurring campaign', async () => {
    const dueSchedule = {
      id: 'sched_1',
      workspace_id: WS_ID,
      user_id: USER_ID,
      topic: 'Automated Viral Shorts',
      template_script: 'Script content',
      interval_days: 7,
      next_run_date: '2026-09-19',
      is_active: 1,
    };

    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    mocks.mockGetD1.mockResolvedValue({ prepare: mockPrepare });
    mocks.mockCreateServerClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: [dueSchedule], error: null }),
          }),
        }),
      }),
    });

    const res = await processRecurringCampaignBatch(TODAY);

    expect(res.processed).toBe(1);
    expect(res.dispatched).toBe(1);
    expect(res.skippedQuota).toBe(0);
    expect(res.skippedPreflight).toBe(0);
    expect(res.failures).toEqual([]);

    expect(mocks.mockCheckMissionQuota).toHaveBeenCalledWith(USER_ID, 'PREMIUM', 'missions');
    expect(mocks.mockGenerateCampaignBlueprint).toHaveBeenCalledWith(WS_ID, 'Automated Viral Shorts');
    expect(mocks.mockRunMissionPreflightCheck).toHaveBeenCalled();
    expect(mocks.mockCreateMission).toHaveBeenCalled();
    expect(mocks.mockDeductCredits).toHaveBeenCalledWith(
      USER_ID,
      150,
      expect.any(String),
      'recurring_campaign_dispatch',
    );
    expect(mocks.mockDispatchMultiTrackMission).toHaveBeenCalled();

    // Verify CAS advance: advances by 7 days to 2026-09-26
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE scheduled_campaigns'));
    expect(mockBind).toHaveBeenCalledWith(
      '2026-09-26',
      TODAY,
      'sched_1',
      '2026-09-19',
    );
  });

  it('2. skips schedule when user exceeds monthly tier quota', async () => {
    const dueSchedule = {
      id: 'sched_quota_limit',
      workspace_id: WS_ID,
      user_id: USER_ID,
      topic: 'Heavy Creator',
      interval_days: 7,
      next_run_date: TODAY,
      is_active: 1,
    };

    mocks.mockGetD1.mockResolvedValue(null);
    mocks.mockCreateServerClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: [dueSchedule], error: null }),
          }),
        }),
      }),
    });

    mocks.mockCheckMissionQuota.mockResolvedValue({
      allowed: false,
      used: 10,
      limit: 10,
      resetAt: '2026-10-01T00:00:00.000Z',
    });

    const res = await processRecurringCampaignBatch(TODAY);

    expect(res.processed).toBe(1);
    expect(res.skippedQuota).toBe(1);
    expect(res.dispatched).toBe(0);
    expect(mocks.mockCreateMission).not.toHaveBeenCalled();
    expect(mocks.mockDeductCredits).not.toHaveBeenCalled();
    expect(mocks.mockDispatchMultiTrackMission).not.toHaveBeenCalled();
  });

  it('3. skips schedule when 7-gate preflight check fails (fail-closed)', async () => {
    const dueSchedule = {
      id: 'sched_preflight_fail',
      workspace_id: WS_ID,
      user_id: USER_ID,
      topic: 'Preflight Blocked',
      interval_days: 7,
      next_run_date: TODAY,
      is_active: 1,
    };

    mocks.mockGetD1.mockResolvedValue(null);
    mocks.mockCreateServerClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: [dueSchedule], error: null }),
          }),
        }),
      }),
    });

    mocks.mockRunMissionPreflightCheck.mockResolvedValue({
      passed: false,
      failureCode: 'INSUFFICIENT_ENTITLEMENT',
      failureReason: 'Zero MCU Balance',
      gates: {} as unknown as Record<string, unknown>,
    });

    const res = await processRecurringCampaignBatch(TODAY);

    expect(res.processed).toBe(1);
    expect(res.skippedPreflight).toBe(1);
    expect(res.dispatched).toBe(0);
    expect(mocks.mockCreateMission).not.toHaveBeenCalled();
    expect(mocks.mockDeductCredits).not.toHaveBeenCalled();
  });

  it('4. records failure when MCU credit deduction fails (insufficient credits)', async () => {
    const dueSchedule = {
      id: 'sched_no_credits',
      workspace_id: WS_ID,
      user_id: USER_ID,
      topic: 'No Credits',
      interval_days: 7,
      next_run_date: TODAY,
      is_active: 1,
    };

    mocks.mockGetD1.mockResolvedValue(null);
    mocks.mockCreateServerClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: [dueSchedule], error: null }),
          }),
        }),
      }),
    });

    // deductCredits returns false
    mocks.mockDeductCredits.mockResolvedValue(false);

    const res = await processRecurringCampaignBatch(TODAY);

    expect(res.processed).toBe(1);
    expect(res.dispatched).toBe(0);
    expect(res.failures).toContain('sched_no_credits');
    expect(mocks.mockDispatchMultiTrackMission).not.toHaveBeenCalled();
  });

  it('5. returns zero counts cleanly when no schedules are due', async () => {
    mocks.mockGetD1.mockResolvedValue(null);
    mocks.mockCreateServerClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const res = await processRecurringCampaignBatch(TODAY);
    expect(res.processed).toBe(0);
    expect(res.dispatched).toBe(0);
    expect(res.failures).toEqual([]);
  });

  it('6. handles missing scheduled_campaigns table gracefully without throwing', async () => {
    mocks.mockGetD1.mockResolvedValue(null);
    mocks.mockCreateServerClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'no such table: scheduled_campaigns' },
            }),
          }),
        }),
      }),
    });

    const res = await processRecurringCampaignBatch(TODAY);
    expect(res.processed).toBe(0);
    expect(res.dispatched).toBe(0);
    expect(res.failures).toEqual([]);
  });

  it('7. recovers gracefully and records failure when unexpected error throws during processing', async () => {
    const dueSchedule = {
      id: 'sched_throws',
      workspace_id: WS_ID,
      user_id: USER_ID,
      topic: 'Throws Exception',
      interval_days: 7,
      next_run_date: TODAY,
      is_active: 1,
    };

    mocks.mockGetD1.mockResolvedValue(null);
    mocks.mockCreateServerClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: [dueSchedule], error: null }),
          }),
        }),
      }),
    });

    mocks.mockGenerateCampaignBlueprint.mockRejectedValue(new Error('Unexpected Crash'));

    const res = await processRecurringCampaignBatch(TODAY);
    expect(res.processed).toBe(1);
    expect(res.dispatched).toBe(0);
    expect(res.failures).toContain('sched_throws');
  });
});
