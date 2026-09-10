/**
 * Setup Wizard Readiness & Fail-Closed Gate Invariant Tests
 *
 * Tests:
 * 1. verifyUserReadiness logic in tree/readiness/readiness-checker
 * 2. Capability resolution mapping
 * 3. Fail-closed criteria for readyForMissions
 *
 * @module tests/setup-wizard-readiness
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyUserReadiness } from '@/tree/readiness/readiness-checker';
import { resolveCapabilities } from '@/seed/ai/capability-model';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn().mockResolvedValue(null),
  createServerClient: vi.fn().mockReturnValue(null),
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  listUserApiKeyProviders: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  getBalance: vi.fn().mockResolvedValue({ credits_remaining: 0 }),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn().mockResolvedValue('BASIC'),
}));

import { listUserApiKeyProviders } from '@/tree/byok/user-api-key-store';
import { getBalance } from '@/tree/mcu/credits-repo';
import { getUserTier } from '@/seed/db/get-user-tier';

describe('Setup Wizard Dynamic Readiness Checker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails closed when no BYOK providers and 0 MCU balance', async () => {
    vi.mocked(listUserApiKeyProviders).mockResolvedValue([]);
    vi.mocked(getBalance).mockResolvedValue({ credits_remaining: 0 } as any);
    vi.mocked(getUserTier).mockResolvedValue('BASIC');

    const result = await verifyUserReadiness({
      userId: 'user-1',
      emailVerified: true,
    });

    expect(result.ownerVerified).toBe(true);
    expect(result.byokEncrypted).toBe(false);
    expect(result.providersConfigured).toEqual([]);
    expect(result.mcuBalance).toBe(0);
    expect(result.capabilities).toEqual([]);
    expect(result.readyForMissions).toBe(false);
    expect(result.issues).toContain('NO_BYOK_PROVIDERS_CONFIGURED');
    expect(result.issues).toContain('INSUFFICIENT_MCU_BALANCE');
    expect(result.issues).toContain('NO_AI_CAPABILITIES_AVAILABLE');
  });

  it('marks unverified email as issue', async () => {
    vi.mocked(listUserApiKeyProviders).mockResolvedValue(['openrouter' as any]);
    vi.mocked(getBalance).mockResolvedValue({ credits_remaining: 100 } as any);

    const result = await verifyUserReadiness({
      userId: 'user-2',
      emailVerified: false,
    });

    expect(result.ownerVerified).toBe(false);
    expect(result.issues).toContain('EMAIL_NOT_VERIFIED');
  });

  it('correctly maps active providers to capabilities and enables readiness when fully configured', async () => {
    vi.mocked(listUserApiKeyProviders).mockResolvedValue([
      'openrouter' as any,
      'elevenlabs' as any,
      'fal-ai' as any,
      'd-id' as any,
    ]);
    vi.mocked(getBalance).mockResolvedValue({ credits_remaining: 400 } as any);
    vi.mocked(getUserTier).mockResolvedValue('PREMIUM');

    const result = await verifyUserReadiness({
      userId: 'user-3',
      emailVerified: true,
    });

    expect(result.ownerVerified).toBe(true);
    expect(result.byokEncrypted).toBe(true);
    expect(result.mcuBalance).toBe(400);
    expect(result.tier).toBe('PREMIUM');
    expect(result.subscriptionActive).toBe(true);

    // Capabilities
    expect(result.capabilities).toContain('AI_TEXT');
    expect(result.capabilities).toContain('AI_AUDIO');
    expect(result.capabilities).toContain('AI_IMAGE');
    expect(result.capabilities).toContain('AI_VIDEO');
    expect(result.capabilities).toContain('AVATAR');

    expect(result.readyForMissions).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('fails readyForMissions if balance is 0 despite having keys', async () => {
    vi.mocked(listUserApiKeyProviders).mockResolvedValue(['openrouter' as any]);
    vi.mocked(getBalance).mockResolvedValue({ credits_remaining: 0 } as any);

    const result = await verifyUserReadiness({
      userId: 'user-4',
      emailVerified: true,
    });

    expect(result.readyForMissions).toBe(false);
    expect(result.issues).toContain('INSUFFICIENT_MCU_BALANCE');
  });
});
