/**
 * Cross-Tenant Isolation & Anti-Spoofing Security Regression Tests
 *
 * Validates:
 * 1. Founder email spoofing protection (fail-closed when unverified)
 * 2. Cross-tenant BYOK cryptographic boundary (AES-GCM-256 AAD binding)
 * 3. Cross-tenant readiness query isolation
 *
 * @module security-tests/cross-tenant-and-anti-spoofing.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bootstrapFounderIfConfigured } from '@/seed/auth/founder-bootstrap';
import { encryptApiKey, decryptApiKey } from '@/tree/byok/byok-crypto';
import { verifyUserReadiness } from '@/tree/readiness/readiness-checker';
import { listUserApiKeyProviders } from '@/tree/byok/user-api-key-store';
import { getBalance } from '@/tree/mcu/credits-repo';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getD1 } from '@/seed/db/client';

const TEST_MASTER_KEY = Buffer.from('12345678901234567890123456789012').toString('base64');

const mockDbFirst = vi.fn().mockResolvedValue({ version: 1 });
const mockDbBind = vi.fn(() => ({ run: vi.fn(), all: vi.fn(), first: mockDbFirst }));
const mockDbPrepare = vi.fn(() => ({ bind: mockDbBind, first: mockDbFirst }));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(async () => ({
    prepare: mockDbPrepare,
    batch: vi.fn().mockResolvedValue([]),
  })),
  createServerClient: vi.fn(() => ({
    prepare: mockDbPrepare,
  })),
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  listUserApiKeyProviders: vi.fn(),
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  getBalance: vi.fn(),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Cross-Tenant Isolation & Anti-Spoofing Security Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbFirst.mockResolvedValue({ version: 1 });
    vi.mocked(getD1).mockResolvedValue({
      prepare: mockDbPrepare,
      batch: vi.fn().mockResolvedValue([]),
    } as any);
    process.env.BYOK_MASTER_KEY = TEST_MASTER_KEY;
    process.env.FOUNDER_EMAIL = 'founder@agencyos.network';
  });

  describe('Founder Anti-Spoofing Gate', () => {
    it('blocks unverified malicious user trying to claim founder privileges', async () => {
      const mockBatch = vi.fn();
      vi.mocked(getD1).mockResolvedValue({
        prepare: vi.fn(),
        batch: mockBatch,
      } as any);

      const promoted = await bootstrapFounderIfConfigured({
        id: 'attacker-id-666',
        email: 'founder@agencyos.network',
        emailVerified: false,
      });

      expect(promoted).toBe(false);
      expect(mockBatch).not.toHaveBeenCalled();
    });

    it('blocks promotion if database has emailVerified = 0', async () => {
      const mockFirst = vi.fn().mockResolvedValue({ emailVerified: 0 });
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockBatch = vi.fn();

      vi.mocked(getD1).mockResolvedValue({
        prepare: mockPrepare,
        batch: mockBatch,
      } as any);

      const promoted = await bootstrapFounderIfConfigured({
        id: 'attacker-id-777',
        email: 'founder@agencyos.network',
      });

      expect(promoted).toBe(false);
      expect(mockBatch).not.toHaveBeenCalled();
    });

    it('authorizes promotion only when email is verified', async () => {
      const mockBatch = vi.fn().mockResolvedValue([]);
      const mockBind = vi.fn().mockReturnValue({ run: vi.fn() });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

      vi.mocked(getD1).mockResolvedValue({
        prepare: mockPrepare,
        batch: mockBatch,
      } as any);

      const promoted = await bootstrapFounderIfConfigured({
        id: 'legit-founder-1',
        email: 'founder@agencyos.network',
        emailVerified: true,
      });

      expect(promoted).toBe(true);
      expect(mockBatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cryptographic Cross-Tenant BYOK Key Isolation', () => {
    it('cryptographically binds ciphertext to the owning tenant identity', async () => {
      const plainKey = 'sk-ant-api03-very-secret-key-tenant-alpha';
      const tenantAlphaId = 'usr_alpha_123';
      const tenantBravoId = 'usr_bravo_456';

      // Tenant Alpha encrypts key
      const encryptedBlob = await encryptApiKey(plainKey, tenantAlphaId);

      // Tenant Alpha can decrypt it
      const decryptedAlpha = await decryptApiKey(encryptedBlob, tenantAlphaId);
      expect(decryptedAlpha).toBe(plainKey);

      // Malicious Tenant Bravo attempts to decrypt Tenant Alpha's key
      await expect(decryptApiKey(encryptedBlob, tenantBravoId)).rejects.toThrow();
    });
  });

  describe('Tenant Readiness State Isolation', () => {
    it('isolates user readiness queries strictly by tenant ID', async () => {
      vi.mocked(listUserApiKeyProviders).mockImplementation(async (userId) => {
        if (userId === 'tenant-alpha') return ['openrouter' as any];
        return [];
      });

      vi.mocked(getBalance).mockImplementation(async (userId) => {
        if (userId === 'tenant-alpha') return { credits_remaining: 1000 } as any;
        return { credits_remaining: 0 } as any;
      });

      vi.mocked(getUserTier).mockImplementation(async (userId) => {
        if (userId === 'tenant-alpha') return 'MASTER';
        return 'BASIC';
      });

      const alphaReadiness = await verifyUserReadiness({
        userId: 'tenant-alpha',
        emailVerified: true,
      });
      const bravoReadiness = await verifyUserReadiness({
        userId: 'tenant-bravo',
        emailVerified: true,
      });

      expect(alphaReadiness.readyForMissions).toBe(true);
      expect(alphaReadiness.mcuBalance).toBe(1000);
      expect(alphaReadiness.providersConfigured).toEqual(['openrouter']);

      // Bravo must not inherit Alpha's keys or credits
      expect(bravoReadiness.readyForMissions).toBe(false);
      expect(bravoReadiness.mcuBalance).toBe(0);
      expect(bravoReadiness.providersConfigured).toEqual([]);
    });
  });
});
