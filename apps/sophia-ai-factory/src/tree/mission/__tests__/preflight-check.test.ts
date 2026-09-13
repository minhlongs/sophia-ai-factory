/**
 * Unit tests for tree/mission/preflight-check.
 * Validates all 7 fail-closed gates with focus on the ownership gate
 * using canonical verifyWorkspaceAccess.
 *
 * @module tree/mission/__tests__/preflight-check.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  mockGetCurrentUser,
  mockVerifyWorkspaceAccess,
  mockGetD1,
  mockGetUserTier,
  mockGetBalance,
  mockListUserApiKeyProviders,
  mockGetUserApiKey,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockVerifyWorkspaceAccess: vi.fn(),
  mockGetD1: vi.fn(),
  mockGetUserTier: vi.fn(),
  mockGetBalance: vi.fn(),
  mockListUserApiKeyProviders: vi.fn(),
  mockGetUserApiKey: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  verifyWorkspaceAccess: mockVerifyWorkspaceAccess,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mockGetD1,
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: mockGetUserTier,
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  getBalance: mockGetBalance,
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  listUserApiKeyProviders: mockListUserApiKeyProviders,
  getUserApiKey: mockGetUserApiKey,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { runMissionPreflightCheck } from '../preflight-check';

describe('tree/mission/preflight-check', () => {
  const fakeUserId = 'usr_preflight_1';
  const fakeWorkspaceId = 'ws_preflight_1';
  const fakeD1 = {} as unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetD1.mockResolvedValue(fakeD1);
    mockGetCurrentUser.mockResolvedValue({ id: fakeUserId, email: 'user@test.com' });
    mockVerifyWorkspaceAccess.mockResolvedValue(true);
    mockGetUserTier.mockResolvedValue('PREMIUM');
    mockGetBalance.mockResolvedValue({ credits_remaining: 100 });
    // 'replicate' provides AI_IMAGE and AI_VIDEO
    mockListUserApiKeyProviders.mockResolvedValue(['replicate']);
    mockGetUserApiKey.mockResolvedValue('r8_valid_token_12345');
  });

  describe('Gate 1: Auth', () => {
    it('fails closed when no user is authenticated and no userId passed', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const res = await runMissionPreflightCheck({
        workspaceId: fakeWorkspaceId,
      });
      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('NOT_AUTHENTICATED');
      expect(res.gates.auth.passed).toBe(false);
    });

    it('passes auth when explicit userId is provided', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const res = await runMissionPreflightCheck({
        userId: 'explicit_user',
        workspaceId: 'explicit_user', // ownership passes because workspaceId === userId
        overrides: { storageReady: true, queueReady: true },
      });
      expect(res.gates.auth.passed).toBe(true);
    });
  });

  describe('Gate 2: Ownership Gate (Canonical verifyWorkspaceAccess)', () => {
    it('fails when user does not belong to workspace according to verifyWorkspaceAccess', async () => {
      mockVerifyWorkspaceAccess.mockResolvedValue(false);
      const res = await runMissionPreflightCheck({
        userId: fakeUserId,
        workspaceId: fakeWorkspaceId,
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('WORKSPACE_ACCESS_DENIED');
      expect(res.gates.ownership.passed).toBe(false);
      expect(mockVerifyWorkspaceAccess).toHaveBeenCalledWith(fakeWorkspaceId, fakeUserId, fakeD1);
    });

    it('passes ownership when verifyWorkspaceAccess returns true', async () => {
      mockVerifyWorkspaceAccess.mockResolvedValue(true);
      const res = await runMissionPreflightCheck({
        userId: fakeUserId,
        workspaceId: fakeWorkspaceId,
        overrides: { storageReady: true, queueReady: true },
      });

      expect(res.gates.ownership.passed).toBe(true);
      expect(res.gates.ownership.code).toBe('OWNERSHIP_OK');
    });

    it('bypasses ownership check when membershipVerified override is provided', async () => {
      const res = await runMissionPreflightCheck({
        userId: fakeUserId,
        workspaceId: fakeWorkspaceId,
        overrides: { membershipVerified: true, storageReady: true, queueReady: true },
      });

      expect(res.gates.ownership.passed).toBe(true);
      expect(mockVerifyWorkspaceAccess).not.toHaveBeenCalled();
    });

    it('bypasses verifyWorkspaceAccess when workspaceId === userId (personal workspace)', async () => {
      const res = await runMissionPreflightCheck({
        userId: fakeUserId,
        workspaceId: fakeUserId,
        overrides: { storageReady: true, queueReady: true },
      });

      expect(res.gates.ownership.passed).toBe(true);
      expect(mockVerifyWorkspaceAccess).not.toHaveBeenCalled();
    });
  });

  describe('Gate 3: Entitlement & Cost Spike Guard', () => {
    it('fails closed when estimatedCostCents exceeds MAX_SINGLE_MISSION_COST_CENTS (500)', async () => {
      const res = await runMissionPreflightCheck({
        userId: fakeUserId,
        workspaceId: fakeWorkspaceId,
        estimatedCostCents: 501,
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('BILLING_FAILURE');
      expect(res.gates.entitlement.passed).toBe(false);
    });

    it('fails closed when user has 0 MCU balance on BASIC tier', async () => {
      mockGetUserTier.mockResolvedValue('BASIC');
      mockGetBalance.mockResolvedValue({ credits_remaining: 0 });

      const res = await runMissionPreflightCheck({
        userId: fakeUserId,
        workspaceId: fakeWorkspaceId,
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('INSUFFICIENT_ENTITLEMENT');
      expect(res.gates.entitlement.passed).toBe(false);
    });

    it('passes entitlement on MASTER tier even with 0 MCU balance', async () => {
      mockGetUserTier.mockResolvedValue('MASTER');
      mockGetBalance.mockResolvedValue({ credits_remaining: 0 });

      const res = await runMissionPreflightCheck({
        userId: fakeUserId,
        workspaceId: fakeWorkspaceId,
        overrides: { storageReady: true, queueReady: true },
      });

      expect(res.gates.entitlement.passed).toBe(true);
    });
  });

  describe('Gate 4: Provider Credential Gate', () => {
    it('fails when requiredProvider has no configured key', async () => {
      mockGetUserApiKey.mockResolvedValue(null);

      const res = await runMissionPreflightCheck({
        userId: fakeUserId,
        workspaceId: fakeWorkspaceId,
        requiredProvider: 'elevenlabs',
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('MISSING_PROVIDER_CREDENTIAL');
      expect(res.gates.credential.passed).toBe(false);
    });

    it('fails when user has zero BYOK credentials configured and no requiredProvider specified', async () => {
      mockListUserApiKeyProviders.mockResolvedValue([]);

      const res = await runMissionPreflightCheck({
        userId: fakeUserId,
        workspaceId: fakeWorkspaceId,
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('NO_BYOK_CREDENTIALS');
      expect(res.gates.credential.passed).toBe(false);
    });
  });

  describe('Gate 5: Provider Capability Gate', () => {
    it('fails when configured provider does not support required capability', async () => {
      // 'elevenlabs' supports AI_AUDIO, not AI_VIDEO
      mockListUserApiKeyProviders.mockResolvedValue(['elevenlabs']);

      const res = await runMissionPreflightCheck({
        userId: fakeUserId,
        workspaceId: fakeWorkspaceId,
        capability: 'AI_VIDEO',
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('CAPABILITY_NOT_SUPPORTED');
      expect(res.gates.capability.passed).toBe(false);
    });
  });

  describe('Gate 6 & 7: Storage & Queue Readiness', () => {
    it('fails when storage is not ready', async () => {
      const res = await runMissionPreflightCheck({
        userId: fakeUserId,
        workspaceId: fakeWorkspaceId,
        overrides: { storageReady: false, queueReady: true },
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('STORAGE_UNAVAILABLE');
      expect(res.gates.storage.passed).toBe(false);
    });

    it('fails when queue is not ready', async () => {
      const res = await runMissionPreflightCheck({
        userId: fakeUserId,
        workspaceId: fakeWorkspaceId,
        overrides: { storageReady: true, queueReady: false },
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('QUEUE_UNAVAILABLE');
      expect(res.gates.queue.passed).toBe(false);
    });

    it('passes all 7 gates under valid production-ready configuration', async () => {
      const res = await runMissionPreflightCheck({
        userId: fakeUserId,
        workspaceId: fakeWorkspaceId,
        capability: 'AI_IMAGE',
        overrides: { storageReady: true, queueReady: true },
      });

      expect(res.passed).toBe(true);
      expect(res.failureCode).toBeUndefined();
      expect(res.gates.auth.passed).toBe(true);
      expect(res.gates.ownership.passed).toBe(true);
      expect(res.gates.entitlement.passed).toBe(true);
      expect(res.gates.credential.passed).toBe(true);
      expect(res.gates.capability.passed).toBe(true);
      expect(res.gates.storage.passed).toBe(true);
      expect(res.gates.queue.passed).toBe(true);
    });
  });
});
