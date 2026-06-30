/**
 * Unit tests for audit-logging-service
 * @module forest/raas/__tests__/audit-logging-service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  logAuditAction,
  logLicenseCreation,
  logLicenseValidation,
  logLicenseRevocation,
  logLicenseExtension,
} from '../audit-logging-service';

const mockInsert = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/seed/utils/to-error', () => ({
  toError: vi.fn((e: Error) => e),
}));

function setupDbMock() {
  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    eq: mockEq,
    single: mockSingle,
  });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockResolvedValue({ data: { id: 'license-1' }, error: null });
  mockInsert.mockResolvedValue({ error: null });
  mockSingle.mockResolvedValue({ data: { id: 'license-1' }, error: null });
}

describe('audit-logging-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  describe('logAuditAction', () => {
    it('inserts audit log record', async () => {
      await logAuditAction({
        action: 'CREATE',
        nonce: 'lic_abc',
        tier: 'PREMIUM',
        timestamp: 1700000000,
      });

      expect(mockFrom).toHaveBeenCalledWith('raas_audit_logs');
      expect(mockInsert).toHaveBeenCalledTimes(1);
      const insertArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
      expect(insertArg.action).toBe('CREATE');
      expect(insertArg.license_nonce).toBe('lic_abc');
    });

    it('does not throw when insert fails', async () => {
      mockInsert.mockResolvedValue({ error: new Error('DB error') });

      await expect(
        logAuditAction({
          action: 'VALIDATE',
          nonce: 'lic_abc',
          timestamp: 1700000000,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('logLicenseCreation', () => {
    it('logs CREATE action', async () => {
      await logLicenseCreation({
        nonce: 'lic_new',
        tier: 'BASIC' as never,
        timestamp: 1700000000,
        createdBy: 'user_1',
      });

      const insertArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
      expect(insertArg.action).toBe('CREATE');
      expect(insertArg.license_nonce).toBe('lic_new');
    });

    it('includes optional IP and user agent', async () => {
      await logLicenseCreation({
        nonce: 'lic_new',
        tier: 'PREMIUM' as never,
        timestamp: 1700000000,
        createdBy: 'user_1',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      const insertArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
      expect(insertArg.ip_address).toBe('192.168.1.1');
      expect(insertArg.user_agent).toBe('Mozilla/5.0');
    });
  });

  describe('logLicenseValidation', () => {
    it('logs VALIDATE action with isValid flag', async () => {
      await logLicenseValidation({
        nonce: 'lic_abc',
        isValid: true,
        userId: 'user_1',
      });

      const insertArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
      expect(insertArg.action).toBe('VALIDATE');
      expect((insertArg.details as Record<string, unknown>).isValid).toBe(true);
    });

    it('logs failed validation', async () => {
      await logLicenseValidation({
        nonce: 'lic_abc',
        isValid: false,
      });

      const insertArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
      expect((insertArg.details as Record<string, unknown>).isValid).toBe(false);
    });
  });

  describe('logLicenseRevocation', () => {
    it('logs REVOKE action with reason', async () => {
      await logLicenseRevocation({
        nonce: 'lic_revoked',
        tier: 'BASIC',
        reason: 'subscription_expired',
      });

      const insertArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
      expect(insertArg.action).toBe('REVOKE');
      expect(insertArg.license_nonce).toBe('lic_revoked');
    });

    it('includes revokedBy and IP when provided', async () => {
      await logLicenseRevocation({
        nonce: 'lic_rev',
        revokedBy: 'admin_1',
        ipAddress: '10.0.0.1',
      });

      const insertArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
      expect(insertArg.user_id).toBe('admin_1');
      expect(insertArg.ip_address).toBe('10.0.0.1');
    });
  });

  describe('logLicenseExtension', () => {
    it('logs UPDATE action for extension', async () => {
      await logLicenseExtension({
        nonce: 'lic_ext',
        tier: 'PREMIUM',
        days: 30,
        extendedBy: 'admin_1',
        previousExpiresAt: 1700000000,
        newExpiresAt: 1702592000,
      });

      const insertArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
      expect(insertArg.action).toBe('UPDATE');
      const details = insertArg.details as Record<string, unknown>;
      expect(details.action).toBe('EXTEND');
      expect(details.days).toBe(30);
      expect(details.extendedBy).toBe('admin_1');
    });
  });
});
