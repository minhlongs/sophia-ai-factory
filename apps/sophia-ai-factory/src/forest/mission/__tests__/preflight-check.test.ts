/**
 * Unit tests for 7-gate Mission Preflight Check.
 *
 * Covers:
 * 1. Auth gate (missing user -> fail)
 * 2. Ownership gate (not in workspace -> fail)
 * 3. Entitlement gate (0 MCU, non-MASTER -> fail)
 * 4. Credential gate (no BYOK key -> fail; specific required key missing -> fail)
 * 5. Capability gate (required capability not provided by configured keys -> fail)
 * 6. Storage gate (storage down -> fail)
 * 7. Queue gate (queue down -> fail)
 * 8. All gates pass (happy path)
 *
 * @module forest/mission/__tests__/preflight-check.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runMissionPreflightCheck,
  MAX_SINGLE_MISSION_COST_CENTS,
} from '../preflight-check';

// ── MOCKS ───────────────────────────────────────────────────────────────────

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn(),
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  listUserApiKeyProviders: vi.fn(),
  getUserApiKey: vi.fn(),
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  getBalance: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn(),
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { getUserTier } from '@/seed/db/get-user-tier';
import {
  listUserApiKeyProviders,
  getUserApiKey,
} from '@/tree/byok/user-api-key-store';
import { getBalance } from '@/tree/mcu/credits-repo';

describe('runMissionPreflightCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default happy-path setup
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'usr_default',
      email: 'user@example.com',
      full_name: 'Default User',
      role: 'user',
    });

    vi.mocked(getD1).mockResolvedValue({
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ 1: 1 }),
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof getD1>>);

    vi.mocked(getUserTier).mockResolvedValue('PREMIUM');
    vi.mocked(getBalance).mockResolvedValue({
      credits_remaining: 100,
      credits_total_purchased: 110,
      credits_total_used: 10,
    });

    vi.mocked(listUserApiKeyProviders).mockResolvedValue(['fal-ai', 'openrouter']);
    vi.mocked(getUserApiKey).mockImplementation(async (_userId, provider) => {
      if (provider === 'fal-ai') return 'fal_key_12345';
      if (provider === 'openrouter') return 'or_key_12345';
      return null;
    });
  });

  // 1. Auth Gate
  it('fails fail-closed if user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await runMissionPreflightCheck({
      workspaceId: 'ws_123',
      overrides: { storageReady: true, queueReady: true },
    });

    expect(result.passed).toBe(false);
    expect(result.failureCode).toBe('NOT_AUTHENTICATED');
    expect(result.gates.auth.passed).toBe(false);
  });

  // 2. Ownership Gate
  it('fails fail-closed if user has no access to workspace', async () => {
    vi.mocked(getD1).mockResolvedValue({
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null), // not a member
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof getD1>>);

    const result = await runMissionPreflightCheck({
      userId: 'usr_other',
      workspaceId: 'ws_forbidden',
      overrides: { storageReady: true, queueReady: true },
    });

    expect(result.passed).toBe(false);
    expect(result.failureCode).toBe('WORKSPACE_ACCESS_DENIED');
    expect(result.gates.ownership.passed).toBe(false);
  });

  // 3. Entitlement Gate
  it('fails fail-closed if user has 0 MCU and is not MASTER tier', async () => {
    vi.mocked(getUserTier).mockResolvedValue('BASIC');
    vi.mocked(getBalance).mockResolvedValue({
      credits_remaining: 0,
      credits_total_purchased: 50,
      credits_total_used: 50,
    });

    const result = await runMissionPreflightCheck({
      userId: 'usr_default',
      workspaceId: 'ws_123',
      overrides: { storageReady: true, queueReady: true },
    });

    expect(result.passed).toBe(false);
    expect(result.failureCode).toBe('INSUFFICIENT_ENTITLEMENT');
    expect(result.gates.entitlement.passed).toBe(false);
  });

  it('passes entitlement gate if user is on MASTER tier even with 0 remaining balance', async () => {
    vi.mocked(getUserTier).mockResolvedValue('MASTER');
    vi.mocked(getBalance).mockResolvedValue({
      credits_remaining: 0,
      credits_total_purchased: 1000,
      credits_total_used: 1000,
    });

    const result = await runMissionPreflightCheck({
      userId: 'usr_default',
      workspaceId: 'ws_123',
      overrides: { storageReady: true, queueReady: true },
    });

    expect(result.gates.entitlement.passed).toBe(true);
  });

  // 3b. Spike Guard (Cost Limit Gate)
  it('fails fail-closed with BILLING_FAILURE when estimatedCostCents > MAX_SINGLE_MISSION_COST_CENTS', async () => {
    const result = await runMissionPreflightCheck({
      userId: 'usr_default',
      workspaceId: 'ws_123',
      estimatedCostCents: 600, // > 500
      overrides: { storageReady: true, queueReady: true },
    });

    expect(result.passed).toBe(false);
    expect(result.failureCode).toBe('BILLING_FAILURE');
    expect(result.failureReason).toContain(
      `Preflight aborted: Estimated cost (600¢) exceeds single mission limit (${MAX_SINGLE_MISSION_COST_CENTS}¢)`
    );
    expect(result.gates.entitlement.passed).toBe(false);
    expect(result.gates.entitlement.code).toBe('BILLING_FAILURE');
  });

  it('passes entitlement gate when estimatedCostCents is within bounds (e.g. 150¢)', async () => {
    const result = await runMissionPreflightCheck({
      userId: 'usr_default',
      workspaceId: 'ws_123',
      estimatedCostCents: 150,
      overrides: { storageReady: true, queueReady: true },
    });

    expect(result.passed).toBe(true);
    expect(result.gates.entitlement.passed).toBe(true);
    expect(result.gates.entitlement.details).toMatchObject({
      estimatedCostCents: 150,
    });
  });

  it('succeeds when estimatedCostCents is undefined (backward compatibility)', async () => {
    const result = await runMissionPreflightCheck({
      userId: 'usr_default',
      workspaceId: 'ws_123',
      overrides: { storageReady: true, queueReady: true },
    });

    expect(result.passed).toBe(true);
    expect(result.gates.entitlement.passed).toBe(true);
  });

  it('skips spike guard when estimatedCostCents <= 0', async () => {
    const result = await runMissionPreflightCheck({
      userId: 'usr_default',
      workspaceId: 'ws_123',
      estimatedCostCents: 0,
      overrides: { storageReady: true, queueReady: true },
    });

    expect(result.passed).toBe(true);
    expect(result.gates.entitlement.passed).toBe(true);
  });

  // 4. Provider Credential Gate
  it('fails fail-closed if user has zero BYOK credentials configured', async () => {
    vi.mocked(listUserApiKeyProviders).mockResolvedValue([]);

    const result = await runMissionPreflightCheck({
      userId: 'usr_default',
      workspaceId: 'ws_123',
      overrides: { storageReady: true, queueReady: true },
    });

    expect(result.passed).toBe(false);
    expect(result.failureCode).toBe('NO_BYOK_CREDENTIALS');
    expect(result.gates.credential.passed).toBe(false);
  });

  it('fails fail-closed if specific requiredProvider key is missing or empty', async () => {
    vi.mocked(getUserApiKey).mockResolvedValue(''); // empty key

    const result = await runMissionPreflightCheck({
      userId: 'usr_default',
      workspaceId: 'ws_123',
      requiredProvider: 'replicate',
      overrides: { storageReady: true, queueReady: true },
    });

    expect(result.passed).toBe(false);
    expect(result.failureCode).toBe('MISSING_PROVIDER_CREDENTIAL');
    expect(result.gates.credential.passed).toBe(false);
  });

  // 5. Capability Gate
  it('fails fail-closed if configured providers do not support requested capability', async () => {
    // Only openrouter configured (supports AI_TEXT only)
    vi.mocked(listUserApiKeyProviders).mockResolvedValue(['openrouter']);

    const result = await runMissionPreflightCheck({
      userId: 'usr_default',
      workspaceId: 'ws_123',
      capability: 'AI_VIDEO', // not supported by openrouter
      overrides: { storageReady: true, queueReady: true },
    });

    expect(result.passed).toBe(false);
    expect(result.failureCode).toBe('CAPABILITY_NOT_SUPPORTED');
    expect(result.gates.capability.passed).toBe(false);
  });

  // 6. Storage Gate
  it('fails fail-closed if storage is down', async () => {
    const result = await runMissionPreflightCheck({
      userId: 'usr_default',
      workspaceId: 'ws_123',
      overrides: { storageReady: false, queueReady: true },
    });

    expect(result.passed).toBe(false);
    expect(result.failureCode).toBe('STORAGE_UNAVAILABLE');
    expect(result.gates.storage.passed).toBe(false);
  });

  // 7. Queue Gate
  it('fails fail-closed if queue is down', async () => {
    const result = await runMissionPreflightCheck({
      userId: 'usr_default',
      workspaceId: 'ws_123',
      overrides: { storageReady: true, queueReady: false },
    });

    expect(result.passed).toBe(false);
    expect(result.failureCode).toBe('QUEUE_UNAVAILABLE');
    expect(result.gates.queue.passed).toBe(false);
  });

  // 8. Happy Path
  it('passes all 7 gates when all requirements are satisfied', async () => {
    const result = await runMissionPreflightCheck({
      userId: 'usr_default',
      workspaceId: 'ws_123',
      capability: 'AI_IMAGE',
      overrides: { storageReady: true, queueReady: true },
    });

    expect(result.passed).toBe(true);
    expect(result.failureCode).toBeUndefined();
    expect(result.gates.auth.passed).toBe(true);
    expect(result.gates.ownership.passed).toBe(true);
    expect(result.gates.entitlement.passed).toBe(true);
    expect(result.gates.credential.passed).toBe(true);
    expect(result.gates.capability.passed).toBe(true);
    expect(result.gates.storage.passed).toBe(true);
    expect(result.gates.queue.passed).toBe(true);
  });
});
