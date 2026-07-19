/**
 * Unit tests for raas-license-crud
 * @module forest/raas/__tests__/raas-license-crud.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createLicense,
  getLicenseByNonce,
  getLicenses,
} from '../raas-license-crud';

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockOr = vi.fn();
const mockLt = vi.fn();
const mockIlke = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockFrom = vi.fn();
const mockGt = vi.fn();

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

describe('createLicense', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) });
    mockSingle.mockResolvedValue({ data: { id: 1, nonce: 'lic_new', tier: 'BASIC' }, error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it('creates a license with all fields', async () => {
    const result = await createLicense({
      tier: 'BASIC' as never,
      nonce: 'lic_new_001',
      keyHash: 'hash_abc',
      expiresAt: 1735689600,
      createdBy: 'user_1',
      metadata: { source: 'onboarding' },
    });

    expect(mockFrom).toHaveBeenCalledWith('raas_licenses');
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.key_hash).toBe('hash_abc');
    expect(insertArg.nonce).toBe('lic_new_001');
    expect(insertArg.tier).toBe('BASIC');
    expect(insertArg.is_revoked).toBe(false);
  });

  it('throws on database error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Duplicate key' } });

    await expect(
      createLicense({
        tier: 'BASIC' as never,
        nonce: 'lic_dup',
        keyHash: 'hash_dup',
        expiresAt: 1735689600,
      })
    ).rejects.toThrow('Database error: Duplicate key');
  });

  it('uses null createdBy when not provided', async () => {
    await createLicense({
      tier: 'BASIC' as never,
      nonce: 'lic_sys',
      keyHash: 'hash_sys',
      expiresAt: 1735689600,
    });

    const insertArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.created_by).toBeNull();
  });
});

describe('getLicenseByNonce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('returns license when found', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 1, nonce: 'lic_abc', tier: 'PREMIUM' },
      error: null,
    });

    const result = await getLicenseByNonce('lic_abc');
    expect(result).not.toBeNull();
    expect(result!.nonce).toBe('lic_abc');
  });

  it('returns null when not found (PGRST116)', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });

    const result = await getLicenseByNonce('lic_missing');
    expect(result).toBeNull();
  });

  it('throws on unexpected database error', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: 'UNKNOWN', message: 'Connection failed' },
    });

    await expect(getLicenseByNonce('lic_err')).rejects.toThrow('Database error: Connection failed');
  });
});

describe('getLicenses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(mockEq);
    mockEq.mockReturnValue(mockEq);
    mockOr.mockReturnValue(mockEq);
    mockLt.mockReturnValue(mockEq);
    mockIlke.mockReturnValue(mockEq);
    mockOrder.mockReturnValue(mockRange);
    mockRange.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });
    mockGt.mockReturnValue(mockEq);
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  const chainable = (): unknown => ({
    eq: mockEq,
    or: mockOr,
    lt: mockLt,
    gt: mockGt,
    ilike: mockIlke,
    order: mockOrder,
    range: mockRange,
    select: mockSelect,
  });

  const setupQueryChain = () => {
    mockSelect.mockReturnValue(chainable());
    mockEq.mockReturnValue(chainable());
    mockOrder.mockReturnValue(chainable());
    mockOr.mockReturnValue(chainable());
    mockLt.mockReturnValue(chainable());
    mockGt.mockReturnValue(chainable());
    mockIlke.mockReturnValue(chainable());
  };

  it('returns empty list with default pagination', async () => {
    mockRange.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });
    setupQueryChain();

    const result = await getLicenses({});
    expect(result.licenses).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('throws on database error', async () => {
    setupQueryChain();
    mockRange.mockResolvedValue({
      data: null,
      error: { message: 'DB connection error' },
      count: 0,
    });

    await expect(getLicenses({})).rejects.toThrow('DB connection error');
  });

  it('filters by tier', async () => {
    setupQueryChain();
    mockRange.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });

    await getLicenses({ tier: 'PREMIUM' as never });
    expect(mockEq).toHaveBeenCalledWith('tier', 'PREMIUM');
  });

  it('filters by status=revoked', async () => {
    setupQueryChain();
    mockRange.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });

    await getLicenses({ status: 'revoked' });
    expect(mockEq).toHaveBeenCalledWith('is_revoked', true);
  });

  it('uses correct pagination offset', async () => {
    setupQueryChain();
    mockRange.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });

    await getLicenses({ page: 3, limit: 10 });
    expect(mockRange).toHaveBeenCalledWith(20, 29);
  });
});
