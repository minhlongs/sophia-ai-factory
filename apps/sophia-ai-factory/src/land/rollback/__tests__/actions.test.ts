/**
 * Unit tests for land/rollback Server Actions.
 * Verifies role enforcement (ADMIN/OWNER for rollback mutation),
 * workspace access (read-only for history), validation, and error handling.
 *
 * @module land/rollback/__tests__/actions.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  mockGetCurrentUser,
  mockResolveOrgId,
  mockHasWorkspaceRole,
  mockVerifyWorkspaceAccess,
  mockGetD1,
  mockLogRollback,
  mockGetRollbackHistory,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockResolveOrgId: vi.fn(),
  mockHasWorkspaceRole: vi.fn(),
  mockVerifyWorkspaceAccess: vi.fn(),
  mockGetD1: vi.fn(),
  mockLogRollback: vi.fn(),
  mockGetRollbackHistory: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/auth/resolve-org-id', () => ({
  resolveOrgId: mockResolveOrgId,
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  hasWorkspaceRole: mockHasWorkspaceRole,
  verifyWorkspaceAccess: mockVerifyWorkspaceAccess,
}));

const mockPrepare = vi.fn();
const mockBind = vi.fn();
const mockFirst = vi.fn();

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

vi.mock('@/tree/rollback', () => ({
  logRollback: mockLogRollback,
  getRollbackHistory: mockGetRollbackHistory,
}));

import { rollbackMissionAction, getRollbackHistoryAction } from '../actions';

describe('land/rollback/actions', () => {
  const fakeUser = { id: 'user_456', email: 'admin@example.com' };
  const fakeWorkspaceId = 'ws_rollback_1';
  const validMissionId = '11111111-1111-4111-a111-111111111111';
  const validReason = 'Quality check failed in rendering phase';

  const fakeD1 = {
    prepare: mockPrepare,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetD1.mockResolvedValue(fakeD1);
    mockGetCurrentUser.mockResolvedValue(fakeUser);
    mockResolveOrgId.mockResolvedValue(fakeWorkspaceId);
    mockHasWorkspaceRole.mockResolvedValue(true);
    mockVerifyWorkspaceAccess.mockResolvedValue(true);

    mockPrepare.mockReturnValue({
      bind: mockBind,
    });
    mockBind.mockReturnValue({
      first: mockFirst,
    });
    mockFirst.mockResolvedValue({ id: validMissionId, status: 'in_progress' });
  });

  describe('rollbackMissionAction', () => {
    it('returns VALIDATION_ERROR on invalid missionId format', async () => {
      const res = await rollbackMissionAction('not-a-uuid', validReason);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns VALIDATION_ERROR when reason is too short', async () => {
      const res = await rollbackMissionAction(validMissionId, 'bad');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns NOT_AUTHENTICATED when unauthenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const res = await rollbackMissionAction(validMissionId, validReason);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('NOT_AUTHENTICATED');
      }
    });

    it('returns NOT_FOUND when workspace is missing for user', async () => {
      mockResolveOrgId.mockResolvedValue(null);
      const res = await rollbackMissionAction(validMissionId, validReason);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns FORBIDDEN when user is not ADMIN or OWNER', async () => {
      mockHasWorkspaceRole.mockResolvedValue(false);
      const res = await rollbackMissionAction(validMissionId, validReason);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
      }
      expect(mockHasWorkspaceRole).toHaveBeenCalledWith(fakeWorkspaceId, fakeUser.id, 'ADMIN', fakeD1);
    });

    it('returns NOT_FOUND when mission does not exist in workspace', async () => {
      mockFirst.mockResolvedValue(null);
      const res = await rollbackMissionAction(validMissionId, validReason);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('NOT_FOUND');
      }
    });

    it('executes rollback and logs when user is ADMIN or OWNER', async () => {
      mockLogRollback.mockResolvedValue({ ok: true, value: undefined });

      const res = await rollbackMissionAction(validMissionId, validReason);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.success).toBe(true);
      }
      expect(mockLogRollback).toHaveBeenCalledWith({
        workspaceId: fakeWorkspaceId,
        missionId: validMissionId,
        reason: validReason,
        fromStatus: 'in_progress',
        toStatus: 'rolled_back',
        triggeredBy: fakeUser.id,
      });
    });

    it('returns REPO_ERROR when logRollback fails', async () => {
      mockLogRollback.mockResolvedValue({
        ok: false,
        error: { message: 'Failed to write rollback log', code: 'WRITE_FAIL' },
      });

      const res = await rollbackMissionAction(validMissionId, validReason);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('REPO_ERROR');
      }
    });
  });

  describe('getRollbackHistoryAction', () => {
    it('returns NOT_AUTHENTICATED when unauthenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const res = await getRollbackHistoryAction(validMissionId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('NOT_AUTHENTICATED');
      }
    });

    it('returns FORBIDDEN when user lacks workspace access', async () => {
      mockVerifyWorkspaceAccess.mockResolvedValue(false);
      const res = await getRollbackHistoryAction(validMissionId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
      }
      expect(mockVerifyWorkspaceAccess).toHaveBeenCalledWith(fakeWorkspaceId, fakeUser.id, fakeD1);
    });

    it('returns filtered rollback history for workspace members', async () => {
      const records = [
        {
          id: 'rb_1',
          workspaceId: fakeWorkspaceId,
          missionId: validMissionId,
          reason: validReason,
          fromStatus: 'in_progress',
          toStatus: 'rolled_back',
          triggeredBy: fakeUser.id,
          createdAt: '2026-09-13T00:00:00Z',
        },
        {
          id: 'rb_2',
          workspaceId: 'other_ws',
          missionId: validMissionId,
          reason: 'Other reason',
          fromStatus: 'failed',
          toStatus: 'rolled_back',
          triggeredBy: 'other_user',
          createdAt: '2026-09-13T01:00:00Z',
        },
      ];
      mockGetRollbackHistory.mockResolvedValue({ ok: true, value: records });

      const res = await getRollbackHistoryAction(validMissionId);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.length).toBe(1);
        expect(res.value[0].id).toBe('rb_1');
      }
    });

    it('returns REPO_ERROR when getRollbackHistory fails', async () => {
      mockGetRollbackHistory.mockResolvedValue({
        ok: false,
        error: { message: 'DB read failed', code: 'READ_FAIL' },
      });

      const res = await getRollbackHistoryAction(validMissionId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('REPO_ERROR');
      }
    });
  });
});
