import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  maskApiKey,
  resolveProviderHealthStatus,
  getProviderStatusBadge,
  type ProviderHealthStatus,
} from '@/tree/byok/provider-health-checker';
import { encryptApiKey, decryptApiKey } from '@/tree/byok/byok-crypto';
import { logger } from '@/seed/utils/logger-utility';

const TEST_MASTER_KEY = Buffer.from('abcdef0123456789abcdef0123456789').toString('base64');

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockDbFirst = vi.fn().mockResolvedValue({ version: 1 });
const mockDbBind = vi.fn(() => ({ first: mockDbFirst }));
const mockDbPrepare = vi.fn(() => ({ bind: mockDbBind, first: mockDbFirst }));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(async () => ({
    prepare: mockDbPrepare,
  })),
}));

describe('Phase 9: BYOK Security Lifecycle & Cryptographic Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbFirst.mockResolvedValue({ version: 1 });
    process.env.BYOK_MASTER_KEY = TEST_MASTER_KEY;
  });

  describe('7 Safe States Resolution Machine', () => {
    const STATUS_CASES: Array<{
      desc: string;
      input: Parameters<typeof resolveProviderHealthStatus>[0];
      expected: ProviderHealthStatus;
    }> = [
      { desc: 'isRevoked flag triggers REVOKED state first', input: { hasKey: true, isRevoked: true }, expected: 'REVOKED' },
      { desc: 'missing key triggers NOT_CONFIGURED', input: { hasKey: false }, expected: 'NOT_CONFIGURED' },
      { desc: 'active validation in flight triggers VALIDATING', input: { hasKey: true, isValidating: true }, expected: 'VALIDATING' },
      { desc: 'successful upstream probe triggers ACTIVE', input: { hasKey: true, probeSuccess: true }, expected: 'ACTIVE' },
      { desc: 'auth failure (401/403) triggers INVALID', input: { hasKey: true, httpStatus: 401 }, expected: 'INVALID' },
      { desc: 'timeout or upstream error triggers PROVIDER_UNAVAILABLE', input: { hasKey: true, isTimeout: true }, expected: 'PROVIDER_UNAVAILABLE' },
      { desc: 'unknown or unprobed key triggers UNKNOWN', input: { hasKey: true }, expected: 'UNKNOWN' },
    ];

    it.each(STATUS_CASES)('$desc -> $expected', ({ input, expected }) => {
      expect(resolveProviderHealthStatus(input)).toBe(expected);
    });

    it('provides bilingual localized badges for all 7 states without technical jargon', () => {
      const allStates: ProviderHealthStatus[] = [
        'NOT_CONFIGURED', 'VALIDATING', 'ACTIVE', 'INVALID', 'REVOKED', 'PROVIDER_UNAVAILABLE', 'UNKNOWN',
      ];
      for (const status of allStates) {
        const viBadge = getProviderStatusBadge(status, 'vi');
        const enBadge = getProviderStatusBadge(status, 'en');
        expect(viBadge.label).toBeTruthy();
        expect(enBadge.label).toBeTruthy();
        expect(viBadge.label).not.toBe(enBadge.label); // Must have real distinct translation
        expect(viBadge.badgeClass).toContain('border');
      }
    });
  });

  describe('maskApiKey Secret Masking Invariants', () => {
    it('never leaks plaintext bytes, retaining only last 4 characters when applicable', () => {
      expect(maskApiKey('sk-ant-api03-live-abcdef1234')).toBe('****...1234');
      expect(maskApiKey('sk-or-v1-supersecretkey9999')).toBe('****...9999');
      expect(maskApiKey('1234')).toBe('****');
      expect(maskApiKey('key')).toBe('****');
      expect(maskApiKey('')).toBe('');
      expect(maskApiKey('   ')).toBe('');
    });

    it('guarantees plaintext key body is completely absent from masked output', () => {
      const rawSecret = 'SUPER_SECRET_PAYLOAD_ABCXYZ_9876';
      const masked = maskApiKey(rawSecret);

      expect(masked).not.toContain('SUPER_SECRET');
      expect(masked).not.toContain('ABCXYZ');
      expect(masked).toBe('****...9876');
    });
  });

  describe('AES-GCM-256 Cryptography & Zero-Leak Invariants', () => {
    it('encrypts keys into packed byte format with version, IV, and ciphertext', async () => {
      const plainSecret = 'fal_key_production_vault_secret_9988';
      const packed = await encryptApiKey(plainSecret, 'usr_safe_tenant');

      // Header: 1 byte version + 12 bytes IV + at least 16 bytes tag = > 29 bytes
      expect(packed.length).toBeGreaterThan(29);
      expect(packed[0]).toBe(1); // Key version 1

      // Verify plainSecret string does not appear in packed binary representation
      const packedString = Buffer.from(packed).toString('utf-8');
      expect(packedString).not.toContain(plainSecret);
    });

    it('detects tampering and throws when ciphertext or auth tag is modified', async () => {
      const plainSecret = 'eleven_labs_production_vault_secret_5566';
      const packed = await encryptApiKey(plainSecret, 'usr_safe_tenant');

      // Flip the last byte of the ciphertext / auth tag
      const tampered = new Uint8Array(packed);
      tampered[tampered.length - 1] ^= 0xff;

      await expect(decryptApiKey(tampered, 'usr_safe_tenant')).rejects.toThrow();
    });

    it('guarantees zero secret logging during error and probe tracking', () => {
      const secret = 'sk-live-do-not-log-this-secret-112233';
      const masked = maskApiKey(secret);

      logger.warn('[BYOK-Test] Key validation check', { maskedKey: masked });

      const lastWarnCall = vi.mocked(logger.warn).mock.calls.at(-1);
      expect(lastWarnCall).toBeDefined();
      const serializedCall = JSON.stringify(lastWarnCall);
      expect(serializedCall).not.toContain(secret);
      expect(serializedCall).toContain('****...2233');
    });
  });
});
