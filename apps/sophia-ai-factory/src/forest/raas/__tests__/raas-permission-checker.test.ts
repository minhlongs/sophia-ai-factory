/**
 * Unit tests for raas-permission-checker
 * @module forest/raas/__tests__/raas-permission-checker.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  revokeLicense,
  extendLicense,
  incrementValidationCount,
} from '../raas-permission-checker';

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockDelete = vi.fn();

const mockDb = {
  from: mockFrom,
};

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => mockDb),
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

vi.mock('../raas-license-crud', () => ({
  getLicenseByNonce: vi.fn(),
}));

describe('revokeLicense', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock chain: from() returns an object with all chainable methods
    mockFrom.mockImplementation(() => ({
      select: mockSelect,
      update: mockUpdate,
      delete: mockDelete,
    }));
    mockSelect.mockImplementation(() => ({
      eq: vi.fn(() => ({
        maybeSingle: mockMaybeSingle,
      })),
    }));
    // Default: org_members query returns no membership (auth not checked for no revokedBy)
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ select: () => ({ single: mockSingle }) });
  });

  it('revokes an existing license', async () => {
    const { getLicenseByNonce } = await import('../raas-license-crud');
    (getLicenseByNonce as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      nonce: 'lic_abc',
      tier: 'PREMIUM',
      user_id: 'user_1',
    });
    // Mock org_members: both admin user and license owner are in the same org
    mockMaybeSingle.mockResolvedValue({
      data: { org_id: 'org_1', role: 'admin' },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: { id: 1, nonce: 'lic_abc', is_revoked: true },
      error: null,
    });

    const result = await revokeLicense('lic_abc', 'admin_1');
    expect(result.is_revoked).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_revoked: true })
    );
  });

  it('throws when license not found', async () => {
    const { getLicenseByNonce } = await import('../raas-license-crud');
    (getLicenseByNonce as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(revokeLicense('lic_missing')).rejects.toThrow('License not found');
  });

  it('throws on database error during update', async () => {
    const { getLicenseByNonce } = await import('../raas-license-crud');
    (getLicenseByNonce as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      nonce: 'lic_err',
      tier: 'BASIC',
    });
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Update failed' } });

    await expect(revokeLicense('lic_err')).rejects.toThrow('Database error');
  });
});

describe('extendLicense', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ select: () => ({ single: mockSingle }) });
    mockFrom.mockReturnValue({ update: mockUpdate });
  });

  it('extends license expiration by N days', async () => {
    const { getLicenseByNonce } = await import('../raas-license-crud');
    const baseExpiry = Math.floor(Date.now() / 1000);
    (getLicenseByNonce as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      nonce: 'lic_ext',
      tier: 'PREMIUM',
      expires_at: baseExpiry,
      is_revoked: false,
    });
    mockSingle.mockResolvedValue({
      data: { id: 1, nonce: 'lic_ext', expires_at: baseExpiry + 864000 },
      error: null,
    });

    const result = await extendLicense('lic_ext', 10);
    expect(mockUpdate).toHaveBeenCalled();
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.expires_at).toBe(baseExpiry + 864000);
  });

  it('throws when license not found', async () => {
    const { getLicenseByNonce } = await import('../raas-license-crud');
    (getLicenseByNonce as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(extendLicense('lic_missing', 30)).rejects.toThrow('License not found');
  });

  it('throws when trying to extend revoked license', async () => {
    const { getLicenseByNonce } = await import('../raas-license-crud');
    (getLicenseByNonce as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      nonce: 'lic_rev',
      tier: 'BASIC',
      expires_at: 1700000000,
      is_revoked: true,
    });

    await expect(extendLicense('lic_rev', 30)).rejects.toThrow('Cannot extend revoked license');
  });

  it('handles null expires_at by using current time', async () => {
    const { getLicenseByNonce } = await import('../raas-license-crud');
    (getLicenseByNonce as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      nonce: 'lic_null',
      tier: 'BASIC',
      expires_at: null,
      is_revoked: false,
    });
    mockSingle.mockResolvedValue({
      data: { id: 1, nonce: 'lic_null' },
      error: null,
    });

    const now = Math.floor(Date.now() / 1000);
    await extendLicense('lic_null', 7);
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.expires_at).toBeGreaterThanOrEqual(now + 604800 - 100);
    expect(updateArg.expires_at).toBeLessThanOrEqual(now + 604800 + 100);
  });
});

describe('incrementValidationCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ update: mockUpdate });
  });

  it('increments validation count by 1', async () => {
    const { getLicenseByNonce } = await import('../raas-license-crud');
    (getLicenseByNonce as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      nonce: 'lic_vc',
      metadata: { validateCount: 5 },
    });

    await incrementValidationCount('lic_vc');
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect((updateArg.metadata as Record<string, unknown>).validateCount).toBe(6);
  });

  it('starts at 0 when metadata validateCount is missing', async () => {
    const { getLicenseByNonce } = await import('../raas-license-crud');
    (getLicenseByNonce as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      nonce: 'lic_new',
      metadata: {},
    });

    await incrementValidationCount('lic_new');
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect((updateArg.metadata as Record<string, unknown>).validateCount).toBe(1);
  });

  it('does nothing when license not found', async () => {
    const { getLicenseByNonce } = await import('../raas-license-crud');
    (getLicenseByNonce as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await incrementValidationCount('lic_missing');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('handles database error gracefully', async () => {
    const { getLicenseByNonce } = await import('../raas-license-crud');
    (getLicenseByNonce as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      nonce: 'lic_err',
      metadata: { validateCount: 3 },
    });
    mockEq.mockResolvedValue({ error: { message: 'Update failed' } });

    await expect(incrementValidationCount('lic_err')).resolves.not.toThrow();
  });
});
