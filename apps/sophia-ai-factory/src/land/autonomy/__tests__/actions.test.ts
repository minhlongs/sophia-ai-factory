/**
 * Unit tests for land/autonomy Server Actions.
 * Verifies auth, workspace membership guard, validation, error handling,
 * and integration with canonical workspace-access.
 *
 * @module land/autonomy/__tests__/actions.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  mockGetCurrentUser,
  mockResolveOrgId,
  mockVerifyWorkspaceAccess,
  mockGetD1,
  mockGetAutonomyConfig,
  mockSetAutonomyLevel,
  mockListMissionTypePolicies,
  mockSetMissionTypePolicy,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockResolveOrgId: vi.fn(),
  mockVerifyWorkspaceAccess: vi.fn(),
  mockGetD1: vi.fn(),
  mockGetAutonomyConfig: vi.fn(),
  mockSetAutonomyLevel: vi.fn(),
  mockListMissionTypePolicies: vi.fn(),
  mockSetMissionTypePolicy: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/auth/resolve-org-id', () => ({
  resolveOrgId: mockResolveOrgId,
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  verifyWorkspaceAccess: mockVerifyWorkspaceAccess,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mockGetD1,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/tree/autonomy', () => ({
  getAutonomyConfig: mockGetAutonomyConfig,
  setAutonomyLevel: mockSetAutonomyLevel,
  listMissionTypePolicies: mockListMissionTypePolicies,
  setMissionTypePolicy: mockSetMissionTypePolicy,
}));

import {
  getAutonomyConfigAction,
  setAutonomyLevelAction,
  listMissionTypePoliciesAction,
  setMissionTypePolicyAction,
} from '../actions';

describe('land/autonomy/actions', () => {
  const fakeUser = { id: 'user_123', email: 'user@example.com' };
  const fakeWorkspaceId = 'ws_abc';
  const fakeD1 = {} as unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetD1.mockResolvedValue(fakeD1);
    mockGetCurrentUser.mockResolvedValue(fakeUser);
    mockResolveOrgId.mockResolvedValue(fakeWorkspaceId);
    mockVerifyWorkspaceAccess.mockResolvedValue(true);
  });

  describe('getAutonomyConfigAction', () => {
    it('returns NOT_AUTHENTICATED when unauthenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const res = await getAutonomyConfigAction(fakeWorkspaceId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('NOT_AUTHENTICATED');
      }
    });

    it('returns DB_ERROR when D1 is unavailable', async () => {
      mockGetD1.mockResolvedValue(null);
      const res = await getAutonomyConfigAction(fakeWorkspaceId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('DB_ERROR');
      }
    });

    it('returns NOT_FOUND when no workspace found for user', async () => {
      mockResolveOrgId.mockResolvedValue(null);
      const res = await getAutonomyConfigAction();
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns FORBIDDEN when user lacks workspace access', async () => {
      mockVerifyWorkspaceAccess.mockResolvedValue(false);
      const res = await getAutonomyConfigAction(fakeWorkspaceId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
      }
      expect(mockVerifyWorkspaceAccess).toHaveBeenCalledWith(fakeWorkspaceId, fakeUser.id, fakeD1);
    });

    it('returns success with autonomy config when user has access', async () => {
      mockGetAutonomyConfig.mockResolvedValue({
        ok: true,
        value: {
          level: 2,
          agentType: 'global',
          overrides: { key: 'val' },
        },
      });

      const res = await getAutonomyConfigAction(fakeWorkspaceId);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.level).toBe(2);
        expect(res.value.agentType).toBe('global');
      }
    });

    it('returns REPO_ERROR when getAutonomyConfig fails', async () => {
      mockGetAutonomyConfig.mockResolvedValue({
        ok: false,
        error: { message: 'Failed to read config', code: 'STORAGE_ERROR' },
      });

      const res = await getAutonomyConfigAction(fakeWorkspaceId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('REPO_ERROR');
      }
    });
  });

  describe('setAutonomyLevelAction', () => {
    it('returns VALIDATION_ERROR on invalid level', async () => {
      const res = await setAutonomyLevelAction({ level: 99 });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns NOT_AUTHENTICATED when unauthenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const res = await setAutonomyLevelAction({ level: 1 });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('NOT_AUTHENTICATED');
      }
    });

    it('returns FORBIDDEN when user lacks workspace membership', async () => {
      mockVerifyWorkspaceAccess.mockResolvedValue(false);
      const res = await setAutonomyLevelAction({ level: 1 });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns success on valid input and membership', async () => {
      mockSetAutonomyLevel.mockResolvedValue({ ok: true, value: undefined });
      const res = await setAutonomyLevelAction({ level: 2, agentType: 'video_gen' });
      expect(res.ok).toBe(true);
      expect(mockSetAutonomyLevel).toHaveBeenCalledWith(fakeWorkspaceId, 2, 'video_gen');
    });
  });

  describe('listMissionTypePoliciesAction', () => {
    it('returns NOT_AUTHENTICATED when unauthenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const res = await listMissionTypePoliciesAction(fakeWorkspaceId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('NOT_AUTHENTICATED');
      }
    });

    it('returns FORBIDDEN when user lacks workspace membership', async () => {
      mockVerifyWorkspaceAccess.mockResolvedValue(false);
      const res = await listMissionTypePoliciesAction(fakeWorkspaceId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns list of policies on success', async () => {
      const policies = [
        {
          missionType: 'youtube_short',
          autonomyTier: 1 as const,
          requirePublishApproval: true,
          maxCostCentsPerRun: 100,
          maxAutoRetries: 3,
        },
      ];
      mockListMissionTypePolicies.mockResolvedValue({ ok: true, value: policies });
      const res = await listMissionTypePoliciesAction(fakeWorkspaceId);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toEqual(policies);
      }
    });
  });

  describe('setMissionTypePolicyAction', () => {
    const validPolicyInput = {
      missionType: 'youtube_short',
      autonomyTier: 2,
      requirePublishApproval: false,
      maxCostCentsPerRun: 50,
      maxAutoRetries: 2,
    };

    it('returns VALIDATION_ERROR for invalid autonomyTier', async () => {
      const res = await setMissionTypePolicyAction({
        ...validPolicyInput,
        autonomyTier: 9,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns FORBIDDEN when user lacks workspace membership', async () => {
      mockVerifyWorkspaceAccess.mockResolvedValue(false);
      const res = await setMissionTypePolicyAction(validPolicyInput);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
      }
    });

    it('saves policy and returns updated policy on success', async () => {
      mockSetMissionTypePolicy.mockResolvedValue({
        ok: true,
        value: {
          ...validPolicyInput,
          autonomyTier: 2 as const,
        },
      });

      const res = await setMissionTypePolicyAction(validPolicyInput);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.missionType).toBe('youtube_short');
      }
    });
  });
});
