/**
 * Unit tests for raas-invoice-generator
 * @module forest/raas/__tests__/raas-invoice-generator.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactivateLicenseBySubscription, revokeLicenseBySubscription } from '../raas-invoice-generator';

const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();
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

vi.mock('../audit-logging-service', () => ({
  logAuditAction: vi.fn().mockResolvedValue(undefined),
  logLicenseRevocation: vi.fn().mockResolvedValue(undefined),
}));

function setupSelectMock(resolvedValue: unknown) {
  mockSingle.mockResolvedValue(resolvedValue);
  mockFrom.mockImplementation((_table: string) => ({
    select: vi.fn(() => {
      mockEq.mockReturnValue({ single: mockSingle });
      return { eq: mockEq };
    }),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
    })),
  }));
}

describe('reactivateLicenseBySubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when license not found', async () => {
    setupSelectMock({ data: null, error: { message: 'Not found', details: '' } });

    const result = await reactivateLicenseBySubscription('sub_123');
    expect(result).toBeNull();
  });

  it('reactivates a revoked license', async () => {
    const mockLicense = {
      id: 1,
      nonce: 'lic_rev',
      tier: 'PREMIUM',
      is_revoked: true,
      revoked_at: 1700000000,
      revoked_by: 'system',
      metadata: {},
    };

    // .select().eq().single() returns the license
    // .update().eq().select().single() returns the updated license
    const updatedLicense = { ...mockLicense, is_revoked: false, revoked_at: null };
    mockSingle.mockResolvedValueOnce({ data: mockLicense, error: null });
    mockSingle.mockResolvedValueOnce({ data: updatedLicense, error: null });

    const selectResult = { eq: mockEq };
    mockEq.mockReturnValue({ single: mockSingle });
    mockFrom.mockImplementation((_table: string) => ({
      select: vi.fn(() => selectResult),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockSingle,
          })),
        })),
      })),
    }));

    const result = await reactivateLicenseBySubscription('sub_123');
    expect(result).not.toBeNull();
    expect(result!.is_revoked).toBe(false);
  });

  it('throws on update error', async () => {
    const mockLicense = {
      id: 1,
      nonce: 'lic_err',
      tier: 'BASIC',
      is_revoked: true,
      metadata: {},
    };
    mockSingle.mockResolvedValueOnce({ data: mockLicense, error: null });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Update failed' } });

    const selectResult = { eq: mockEq };
    mockEq.mockReturnValue({ single: mockSingle });
    mockFrom.mockImplementation((_table: string) => ({
      select: vi.fn(() => selectResult),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockSingle,
          })),
        })),
      })),
    }));

    await expect(
      reactivateLicenseBySubscription('sub_err')
    ).rejects.toThrow();
  });
});

describe('revokeLicenseBySubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when license not found', async () => {
    setupSelectMock({ data: null, error: { message: 'Not found', details: '' } });

    const result = await revokeLicenseBySubscription('sub_missing');
    expect(result).toBeNull();
  });

  it('revokes active license by subscription ID', async () => {
    const mockLicense = {
      id: 1,
      nonce: 'lic_active',
      tier: 'PREMIUM',
      is_revoked: false,
      metadata: {},
    };
    const updatedLicense = { ...mockLicense, is_revoked: true };

    mockSingle.mockResolvedValueOnce({ data: mockLicense, error: null });
    mockSingle.mockResolvedValueOnce({ data: updatedLicense, error: null });

    const selectResult = { eq: mockEq };
    mockEq.mockReturnValue({ single: mockSingle });
    mockFrom.mockImplementation((_table: string) => ({
      select: vi.fn(() => selectResult),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockSingle,
          })),
        })),
      })),
    }));

    const result = await revokeLicenseBySubscription('sub_active');
    expect(result).not.toBeNull();
    expect(result!.is_revoked).toBe(true);
  });

  it('supports soft revoke', async () => {
    const mockLicense = {
      id: 1,
      nonce: 'lic_soft',
      tier: 'BASIC',
      is_revoked: false,
      metadata: {},
    };
    const updatedLicense = { ...mockLicense, is_revoked: true };

    mockSingle.mockResolvedValueOnce({ data: mockLicense, error: null });
    mockSingle.mockResolvedValueOnce({ data: updatedLicense, error: null });

    const selectResult = { eq: mockEq };
    mockEq.mockReturnValue({ single: mockSingle });
    mockFrom.mockImplementation((_table: string) => ({
      select: vi.fn(() => selectResult),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockSingle,
          })),
        })),
      })),
    }));

    const result = await revokeLicenseBySubscription('sub_soft', { soft: true });
    expect(result).not.toBeNull();
  });

  it('throws on update error', async () => {
    const mockLicense = {
      id: 1,
      nonce: 'lic_err',
      tier: 'BASIC',
      is_revoked: false,
      metadata: {},
    };
    mockSingle.mockResolvedValueOnce({ data: mockLicense, error: null });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const selectResult = { eq: mockEq };
    mockEq.mockReturnValue({ single: mockSingle });
    mockFrom.mockImplementation((_table: string) => ({
      select: vi.fn(() => selectResult),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockSingle,
          })),
        })),
      })),
    }));

    await expect(revokeLicenseBySubscription('sub_err')).rejects.toThrow();
  });
});
