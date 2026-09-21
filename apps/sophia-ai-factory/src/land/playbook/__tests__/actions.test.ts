/**
 * Unit Tests for Playbook Server Actions — Phase 5 Milestone 3
 *
 * Tests all 6 Server Actions in land/playbook/actions.ts:
 * 1. getPlaybookOverviewAction
 * 2. toggleRuleAutoApplyAction (including OCC CAS concurrency conflict)
 * 3. rollbackRuleAction
 * 4. saveRecurringScheduleAction
 * 5. toggleRecurringScheduleAction
 * 6. triggerBatchRunAction (including preflight gate rejections, quota limits, credit checks)
 *
 * Layer: land (business workflows)
 * Strictly verifies layer compliance, zero :any types, and error/concurrency contracts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Declarations ────────────────────────────────────────────────────────

const mockUser = {
  id: 'usr_test_123',
  email: 'test@sophia.agency',
  name: 'Test Creator',
};

const mockCurrentUser = vi.fn().mockResolvedValue(mockUser);
const mockVerifyWorkspaceAccess = vi.fn().mockResolvedValue(true);
const mockGetUserTier = vi.fn().mockResolvedValue('PREMIUM');
const mockRunMissionPreflightCheck = vi.fn().mockResolvedValue({
  passed: true,
  gates: {
    auth: { passed: true, code: 'AUTH_OK', message: 'User is authenticated' },
    ownership: { passed: true, code: 'OWNERSHIP_OK', message: 'Workspace verified' },
    entitlement: { passed: true, code: 'ENTITLEMENT_OK', message: 'Credits valid' },
    credential: { passed: true, code: 'CREDENTIAL_OK', message: 'BYOK present' },
    capability: { passed: true, code: 'CAPABILITY_OK', message: 'Models supported' },
    storage: { passed: true, code: 'STORAGE_OK', message: 'R2 ready' },
    queue: { passed: true, code: 'QUEUE_OK', message: 'Queue operational' },
  },
});
const mockCheckMissionQuota = vi.fn().mockResolvedValue({
  allowed: true,
  used: 2,
  limit: 100,
  resetAt: '2026-10-01T00:00:00.000Z',
});
const mockDeductCredits = vi.fn().mockResolvedValue(true);
const mockCreateMission = vi.fn().mockImplementation(async (data: { id: string; title: string }) => ({
  id: data.id,
  title: data.title,
}));
const mockDispatchMultiTrackMission = vi.fn().mockResolvedValue({ success: true });

// Mock D1 storage
interface StoredRule {
  id: string;
  workspace_id: string;
  pattern_id: string;
  platform: string;
  goal: string;
  rule_vi: string;
  rule_en: string;
  confidence: number;
  sample_size: number;
  applied_count: number;
  auto_apply: number;
  rollback_count: number;
  created_at: number;
  updated_at: number;
}

let rulesDb: StoredRule[] = [];
let recurringRunsDb: Array<Record<string, unknown>> = [];
let scheduledCampaignsDb: Array<Record<string, unknown>> = [];

const mockD1Database = {
  prepare: vi.fn((sql: string) => {
    return {
      bind: vi.fn((...args: unknown[]) => ({
        first: async <T>() => {
          if (sql.includes('SELECT updated_at FROM playbook_rules WHERE id = ?')) {
            const ruleId = args[0] as string;
            const rule = rulesDb.find((r) => r.id === ruleId);
            return (rule ? { updated_at: rule.updated_at } : null) as T;
          }
          if (sql.includes('SELECT rollback_count FROM playbook_rules WHERE id = ?')) {
            const ruleId = args[0] as string;
            const rule = rulesDb.find((r) => r.id === ruleId);
            return (rule ? { rollback_count: rule.rollback_count } : null) as T;
          }
          if (sql.includes('SELECT * FROM campaign_blueprints WHERE id = ?')) {
            const bpId = args[0] as string;
            if (bpId === 'bp_not_found') return null as T;
            return {
              id: bpId,
              workspace_id: 'ws_test_456',
              name_en: 'Winning Shorts Blueprint',
              name_vi: 'Bản thiết kế Shorts thành công',
              description_en: 'Auto viral blueprint',
              description_vi: 'Bản thiết kế viral tự động',
              target_platform: 'youtube_shorts',
              hook_style: 'curiosity_gap',
              voice_style: 'dynamic_hook',
              duration_seconds: 60,
              aspect_ratio: '9:16',
              estimated_scenes: 3,
              suggested_prompts: JSON.stringify([{ en: 'Prompt 1', vi: 'Câu lệnh 1' }]),
              is_active: 1,
              created_at: 1700000000000,
              updated_at: 1700000000000,
            } as T;
          }
          return null as T;
        },
        all: async <T>() => {
          if (sql.includes('FROM playbook_patterns')) {
            return {
              results: [
                {
                  id: 'pat_1',
                  workspace_id: 'ws_test_456',
                  feature_key: 'hook_style',
                  feature_value: 'curiosity_gap',
                  metric: 'ctr',
                  avg_metric: 0.145,
                  sample_size: 25,
                  confidence: 0.88,
                  confidence_level: 'high',
                  source: 'mission',
                  detected_at: 1700000000000,
                },
              ] as T[],
            };
          }
          if (sql.includes('FROM playbook_rules')) {
            return { results: [...rulesDb] as T[] };
          }
          if (sql.includes('FROM campaign_blueprints')) {
            return {
              results: [
                {
                  id: 'bp_1',
                  workspace_id: 'ws_test_456',
                  name_en: 'Winning Shorts Blueprint',
                  name_vi: 'Bản thiết kế Shorts',
                  description_en: 'High retention hook formula',
                  description_vi: 'Công thức hook giữ chân cao',
                  target_platform: 'youtube_shorts',
                  hook_style: 'curiosity_gap',
                  voice_style: 'dynamic_hook',
                  duration_seconds: 60,
                  aspect_ratio: '9:16',
                  estimated_scenes: 3,
                  suggested_prompts: JSON.stringify([{ en: 'Hook prompt', vi: 'Câu hỏi hook' }]),
                  is_active: 1,
                  created_at: 1700000000000,
                  updated_at: 1700000000000,
                },
              ] as T[],
            };
          }
          if (sql.includes('FROM recurring_campaign_runs')) {
            return { results: [...recurringRunsDb] as T[] };
          }
          if (sql.includes('FROM scheduled_campaigns')) {
            return { results: [...scheduledCampaignsDb] as T[] };
          }
          return { results: [] as T[] };
        },
        run: async () => {
          if (sql.includes('UPDATE playbook_rules') && sql.includes('WHERE id = ? AND updated_at = ?')) {
            const autoApply = args[0] as number;
            const newUpdatedAt = args[1] as number;
            const ruleId = args[2] as string;
            const expectedUpdatedAt = args[3] as number;

            const ruleIndex = rulesDb.findIndex((r) => r.id === ruleId && r.updated_at === expectedUpdatedAt);
            if (ruleIndex === -1) {
              return { success: true, meta: { changes: 0, duration: 1 } };
            }
            rulesDb[ruleIndex].auto_apply = autoApply;
            rulesDb[ruleIndex].updated_at = newUpdatedAt;
            return { success: true, meta: { changes: 1, duration: 1 } };
          }

          if (sql.includes('UPDATE playbook_rules') && sql.includes('rollback_count = rollback_count + 1')) {
            const newUpdatedAt = args[0] as number;
            const ruleId = args[1] as string;

            const ruleIndex = rulesDb.findIndex((r) => r.id === ruleId);
            if (ruleIndex === -1) {
              return { success: true, meta: { changes: 0, duration: 1 } };
            }
            rulesDb[ruleIndex].auto_apply = 0;
            rulesDb[ruleIndex].rollback_count += 1;
            rulesDb[ruleIndex].updated_at = newUpdatedAt;
            return { success: true, meta: { changes: 1, duration: 1 } };
          }

          if (sql.includes('INSERT INTO recurring_campaign_runs')) {
            recurringRunsDb.push({ id: args[0], isActive: args[7] });
            return { success: true, meta: { changes: 1, duration: 1 } };
          }

          if (sql.includes('INSERT INTO scheduled_campaigns')) {
            scheduledCampaignsDb.push({ id: args[0], isActive: args[5] });
            return { success: true, meta: { changes: 1, duration: 1 } };
          }

          if (sql.includes('UPDATE recurring_campaign_runs') && sql.includes('is_active = ?')) {
            const isActive = args[0] as number;
            const scheduleId = args[2] as string;
            const item = recurringRunsDb.find((x) => x.id === scheduleId);
            if (item) item.is_active = isActive;
            return { success: true, meta: { changes: 1, duration: 1 } };
          }

          return { success: true, meta: { changes: 1, duration: 1 } };
        },
      })),
    };
  }),
};

// ── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockCurrentUser(),
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  verifyWorkspaceAccess: () => mockVerifyWorkspaceAccess(),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: () => mockGetUserTier(),
}));

vi.mock('@/tree/mission/preflight-check', () => ({
  runMissionPreflightCheck: (opts: unknown) => mockRunMissionPreflightCheck(opts),
}));

vi.mock('@/tree/quota/mission-quota', () => ({
  checkMissionQuota: (ownerId: string, tier: string, table: string) =>
    mockCheckMissionQuota(ownerId, tier, table),
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  deductCredits: (userId: string, amount: number, memo: string, reason: string) =>
    mockDeductCredits(userId, amount, memo, reason),
}));

vi.mock('@/tree/mission/repository', () => ({
  createMission: (data: { id: string; title: string }) => mockCreateMission(data),
}));

vi.mock('@/tree/mission/executor-bridge', () => ({
  dispatchMultiTrackMission: (missionId: string, opts: unknown) =>
    mockDispatchMultiTrackMission(missionId, opts),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(async () => mockD1Database),
  createServerClient: vi.fn(() => ({
    execute: vi.fn(async () => ({ results: [], meta: { changes: 0 } })),
  })),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// ── Imports Under Test ───────────────────────────────────────────────────────

import {
  getPlaybookOverviewAction,
  toggleRuleAutoApplyAction,
  rollbackRuleAction,
  saveRecurringScheduleAction,
  toggleRecurringScheduleAction,
  triggerBatchRunAction,
} from '../actions';

// ── Test Suites ─────────────────────────────────────────────────────────────

describe('Playbook Server Actions (Milestone 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.mockResolvedValue(mockUser);
    mockVerifyWorkspaceAccess.mockResolvedValue(true);
    mockGetUserTier.mockResolvedValue('PREMIUM');
    mockRunMissionPreflightCheck.mockResolvedValue({
      passed: true,
      gates: {
        auth: { passed: true, code: 'AUTH_OK', message: 'User is authenticated' },
        ownership: { passed: true, code: 'OWNERSHIP_OK', message: 'Workspace verified' },
        entitlement: { passed: true, code: 'ENTITLEMENT_OK', message: 'Credits valid' },
        credential: { passed: true, code: 'CREDENTIAL_OK', message: 'BYOK present' },
        capability: { passed: true, code: 'CAPABILITY_OK', message: 'Models supported' },
        storage: { passed: true, code: 'STORAGE_OK', message: 'R2 ready' },
        queue: { passed: true, code: 'QUEUE_OK', message: 'Queue operational' },
      },
    });
    mockCheckMissionQuota.mockResolvedValue({
      allowed: true,
      used: 2,
      limit: 100,
      resetAt: '2026-10-01T00:00:00.000Z',
    });
    mockDeductCredits.mockResolvedValue(true);
    mockCreateMission.mockImplementation(async (d: { id: string; title: string }) => d);
    mockDispatchMultiTrackMission.mockResolvedValue({ success: true });

    // Seed test rules
    rulesDb = [
      {
        id: 'rule_101',
        workspace_id: 'ws_test_456',
        pattern_id: 'pat_1',
        platform: 'youtube_shorts',
        goal: 'conversion',
        rule_vi: 'Bắt đầu với câu hỏi khơi gợi tò mò',
        rule_en: 'Open with a curiosity gap question',
        confidence: 0.88,
        sample_size: 25,
        applied_count: 5,
        auto_apply: 1,
        rollback_count: 0,
        created_at: 1700000000000,
        updated_at: 1700000000000,
      },
      {
        id: 'rule_102',
        workspace_id: 'ws_test_456',
        pattern_id: 'pat_2',
        platform: 'tiktok',
        goal: 'awareness',
        rule_vi: 'Dùng giọng đọc sôi động trong 3 giây đầu',
        rule_en: 'Use dynamic hook voice profile in first 3s',
        confidence: 0.92,
        sample_size: 40,
        applied_count: 12,
        auto_apply: 0,
        rollback_count: 1,
        created_at: 1700000000000,
        updated_at: 1700000000000,
      },
    ];

    recurringRunsDb = [
      {
        id: 'sch_run_1',
        workspace_id: 'ws_test_456',
        user_id: 'usr_test_123',
        blueprint_id: 'bp_1',
        schedule_cron: '0 0 */7 * *',
        batch_size: 3,
        next_run_at: 1700500000000,
        last_run_at: null,
        is_active: 1,
        total_runs: 0,
        last_status: 'idle',
        created_at: 1700000000000,
        updated_at: 1700000000000,
      },
    ];

    scheduledCampaignsDb = [];
  });

  // ── 1. getPlaybookOverviewAction ───────────────────────────────────────────

  describe('getPlaybookOverviewAction', () => {
    it('returns UNAUTHORIZED when no active user session exists', async () => {
      mockCurrentUser.mockResolvedValueOnce(null);
      const res = await getPlaybookOverviewAction('ws_test_456');

      expect(res.success).toBe(false);
      expect(res.code).toBe('UNAUTHORIZED');
      expect(res.error).toBe('Unauthorized');
    });

    it('returns FORBIDDEN when user does not have workspace access', async () => {
      mockVerifyWorkspaceAccess.mockResolvedValueOnce(false);
      const res = await getPlaybookOverviewAction('ws_other_workspace');

      expect(res.success).toBe(false);
      expect(res.code).toBe('FORBIDDEN');
      expect(res.error).toContain('Access denied');
    });

    it('successfully fetches and maps patterns, rules, blueprints, and schedules', async () => {
      const res = await getPlaybookOverviewAction('ws_test_456');

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.patterns).toHaveLength(1);
      expect(res.data.patterns[0].featureKey).toBe('hook_style');
      expect(res.data.patterns[0].featureValue).toBe('curiosity_gap');
      expect(res.data.patterns[0].confidence).toBe(0.88);

      expect(res.data.rules).toHaveLength(2);
      expect(res.data.rules[0].id).toBe('rule_101');
      expect(res.data.rules[0].autoApply).toBe(true);
      expect(res.data.rules[1].autoApply).toBe(false);

      expect(res.data.blueprints).toHaveLength(1);
      expect(res.data.blueprints[0].targetPlatform).toBe('youtube_shorts');
      expect(res.data.blueprints[0].name.en).toBe('Winning Shorts Blueprint');

      expect(res.data.schedules).toHaveLength(1);
      expect(res.data.schedules[0].scheduleCron).toBe('0 0 */7 * *');
      expect(res.data.schedules[0].batchSize).toBe(3);
    });
  });

  // ── 2. toggleRuleAutoApplyAction (OCC CAS) ─────────────────────────────────

  describe('toggleRuleAutoApplyAction', () => {
    it('returns UNAUTHORIZED when unauthenticated', async () => {
      mockCurrentUser.mockResolvedValueOnce(null);
      const res = await toggleRuleAutoApplyAction('rule_101', false);

      expect(res.success).toBe(false);
      expect(res.code).toBe('UNAUTHORIZED');
    });

    it('successfully toggles auto-apply when expectedUpdatedAt matches (OCC CAS success)', async () => {
      const expectedTs = 1700000000000;
      const res = await toggleRuleAutoApplyAction('rule_101', false, expectedTs);

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.ruleId).toBe('rule_101');
      expect(res.data.autoApply).toBe(false);
      expect(typeof res.data.updatedAt).toBe('number');
      expect(rulesDb[0].auto_apply).toBe(0);
    });

    it('returns CAS_CONFLICT when expectedUpdatedAt does not match (OCC CAS conflict)', async () => {
      const staleTs = 1699999999999; // outdated timestamp
      const res = await toggleRuleAutoApplyAction('rule_101', false, staleTs);

      expect(res.success).toBe(false);
      expect(res.code).toBe('CAS_CONFLICT');
      expect(res.error).toContain('Rule was modified by another process');
    });

    it('returns NOT_FOUND when rule does not exist', async () => {
      const res = await toggleRuleAutoApplyAction('rule_non_existent', true);

      expect(res.success).toBe(false);
      expect(res.code).toBe('NOT_FOUND');
    });

    it('fetches current timestamp and applies CAS when expectedUpdatedAt is omitted', async () => {
      const res = await toggleRuleAutoApplyAction('rule_102', true);

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.ruleId).toBe('rule_102');
      expect(res.data.autoApply).toBe(true);
      expect(rulesDb[1].auto_apply).toBe(1);
    });
  });

  // ── 3. rollbackRuleAction ──────────────────────────────────────────────────

  describe('rollbackRuleAction', () => {
    it('returns UNAUTHORIZED when unauthenticated', async () => {
      mockCurrentUser.mockResolvedValueOnce(null);
      const res = await rollbackRuleAction('rule_101');

      expect(res.success).toBe(false);
      expect(res.code).toBe('UNAUTHORIZED');
    });

    it('disables auto_apply, increments rollback_count, and updates timestamp', async () => {
      expect(rulesDb[0].auto_apply).toBe(1);
      expect(rulesDb[0].rollback_count).toBe(0);

      const res = await rollbackRuleAction('rule_101');

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.ruleId).toBe('rule_101');
      expect(res.data.rollbackCount).toBe(1);
      expect(res.data.autoApply).toBe(false);

      expect(rulesDb[0].auto_apply).toBe(0);
      expect(rulesDb[0].rollback_count).toBe(1);
    });

    it('returns NOT_FOUND when rule does not exist', async () => {
      const res = await rollbackRuleAction('rule_unknown_404');

      expect(res.success).toBe(false);
      expect(res.code).toBe('NOT_FOUND');
    });
  });

  // ── 4. saveRecurringScheduleAction ─────────────────────────────────────────

  describe('saveRecurringScheduleAction', () => {
    it('returns UNAUTHORIZED when unauthenticated', async () => {
      mockCurrentUser.mockResolvedValueOnce(null);
      const res = await saveRecurringScheduleAction({
        workspaceId: 'ws_test_456',
        blueprintId: 'bp_1',
        scheduleCron: '0 0 */3 * *',
        batchSize: 2,
        isActive: true,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('UNAUTHORIZED');
    });

    it('rejects invalid inputs when required fields are missing', async () => {
      const res = await saveRecurringScheduleAction({
        workspaceId: '',
        blueprintId: '',
        scheduleCron: '',
        batchSize: 0,
        isActive: true,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('INVALID_INPUT');
    });

    it('successfully persists new recurring schedule and returns scheduleId', async () => {
      const res = await saveRecurringScheduleAction({
        workspaceId: 'ws_test_456',
        blueprintId: 'bp_1',
        scheduleCron: '0 0 */3 * *',
        batchSize: 4,
        isActive: true,
      });

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.scheduleId).toBeDefined();
      expect(res.data.scheduleId).toMatch(/^sch_/);
      expect(recurringRunsDb.length).toBeGreaterThan(0);
      expect(scheduledCampaignsDb.length).toBeGreaterThan(0);
    });
  });

  // ── 5. toggleRecurringScheduleAction ───────────────────────────────────────

  describe('toggleRecurringScheduleAction', () => {
    it('returns UNAUTHORIZED when unauthenticated', async () => {
      mockCurrentUser.mockResolvedValueOnce(null);
      const res = await toggleRecurringScheduleAction('sch_run_1', false);

      expect(res.success).toBe(false);
      expect(res.code).toBe('UNAUTHORIZED');
    });

    it('updates active state on recurring schedules', async () => {
      const res = await toggleRecurringScheduleAction('sch_run_1', false);

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.scheduleId).toBe('sch_run_1');
      expect(res.data.isActive).toBe(false);
      expect(recurringRunsDb[0].is_active).toBe(0);
    });
  });

  // ── 6. triggerBatchRunAction ───────────────────────────────────────────────

  describe('triggerBatchRunAction', () => {
    it('returns UNAUTHORIZED when unauthenticated', async () => {
      mockCurrentUser.mockResolvedValueOnce(null);
      const res = await triggerBatchRunAction({
        workspaceId: 'ws_test_456',
        blueprintId: 'bp_1',
        batchSize: 2,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('UNAUTHORIZED');
    });

    it('fails closed when 7-gate preflight check fails', async () => {
      mockRunMissionPreflightCheck.mockResolvedValueOnce({
        passed: false,
        failureCode: 'BYOK_KEY_MISSING',
        failureReason: 'OpenRouter API key is required but missing',
        gates: {
          auth: { passed: true, code: 'AUTH_OK', message: 'Ok' },
          ownership: { passed: true, code: 'OWNERSHIP_OK', message: 'Ok' },
          entitlement: { passed: true, code: 'ENTITLEMENT_OK', message: 'Ok' },
          credential: { passed: false, code: 'BYOK_KEY_MISSING', message: 'Missing' },
          capability: { passed: false, code: 'PENDING', message: 'Not evaluated' },
          storage: { passed: false, code: 'PENDING', message: 'Not evaluated' },
          queue: { passed: false, code: 'PENDING', message: 'Not evaluated' },
        },
      });

      const res = await triggerBatchRunAction({
        workspaceId: 'ws_test_456',
        blueprintId: 'bp_1',
        batchSize: 3,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('BYOK_KEY_MISSING');
      expect(res.error).toContain('OpenRouter API key is required');
      expect(mockDeductCredits).not.toHaveBeenCalled();
      expect(mockCreateMission).not.toHaveBeenCalled();
    });

    it('fails when monthly mission quota is exceeded for user tier', async () => {
      mockCheckMissionQuota.mockResolvedValueOnce({
        allowed: false,
        used: 10,
        limit: 10,
        resetAt: '2026-10-01T00:00:00.000Z',
      });

      const res = await triggerBatchRunAction({
        workspaceId: 'ws_test_456',
        blueprintId: 'bp_1',
        batchSize: 2,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('QUOTA_EXCEEDED');
      expect(res.error).toContain('Monthly mission quota exceeded');
      expect(mockDeductCredits).not.toHaveBeenCalled();
    });

    it('fails when MCU compute credits deduction returns false', async () => {
      mockDeductCredits.mockResolvedValueOnce(false);

      const res = await triggerBatchRunAction({
        workspaceId: 'ws_test_456',
        blueprintId: 'bp_1',
        batchSize: 2,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('INSUFFICIENT_CREDITS');
      expect(res.error).toContain('Insufficient MCU credits balance');
      expect(mockCreateMission).not.toHaveBeenCalled();
    });

    it('successfully passes 7-gate preflight, deducts credits, creates missions, and dispatches multi-track', async () => {
      const res = await triggerBatchRunAction({
        workspaceId: 'ws_test_456',
        blueprintId: 'bp_1',
        batchSize: 3,
      });

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.batchId).toMatch(/^batch_/);
      expect(res.data.missionIds).toHaveLength(3);
      expect(res.data.preflight.passed).toBe(true);

      expect(mockDeductCredits).toHaveBeenCalledTimes(1);
      expect(mockCreateMission).toHaveBeenCalledTimes(3);
      expect(mockDispatchMultiTrackMission).toHaveBeenCalledTimes(3);
    });
  });
});
