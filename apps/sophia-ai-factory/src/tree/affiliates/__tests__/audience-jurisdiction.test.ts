/**
 * Tests for audience jurisdiction resolution against the real implementation.
 *
 * The compliance gate's own tests mock this resolver away, so these are the
 * only tests proving that a tenant's declared jurisdiction is read from the
 * right place and that every "I don't know" path really is "I don't know".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAudienceJurisdiction } from '../audience-jurisdiction';

vi.mock('@/seed/tenant-settings/registry', () => ({
  getOrDefault: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

import { getOrDefault } from '@/seed/tenant-settings/registry';
import { getD1 } from '@/seed/db/client';

const mockGetD1 = getD1 as ReturnType<typeof vi.fn>;
const mockGetOrDefault = getOrDefault as ReturnType<typeof vi.fn>;

type GeoSettings = {
  targetJurisdiction?: string | null;
  audienceCountries?: string[];
};

function makeDb() {
  return {} as D1Database;
}

/** Stub the working path: a usable binding plus one geo settings row. */
function stubWorkingPath(geo: GeoSettings) {
  mockGetD1.mockResolvedValue(makeDb());
  mockGetOrDefault.mockResolvedValue(geo);
}

describe('resolveAudienceJurisdiction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the tenant geo settings namespace through the D1 binding', async () => {
    stubWorkingPath({ targetJurisdiction: 'us' });

    await resolveAudienceJurisdiction('tenant-1');

    // Reading a different namespace would make a declared jurisdiction look
    // undeclared, and the gate would block regulated verticals that are legal.
    expect(mockGetOrDefault).toHaveBeenCalledWith(
      expect.anything(),
      'tenant-1',
      'geo',
      {},
    );
  });

  it('normalises a lowercase declaration to the uppercase code the gate compares', async () => {
    stubWorkingPath({ targetJurisdiction: 'us' });
    const result = await resolveAudienceJurisdiction('tenant-1');
    expect(result).toBe('US');
  });

  it('trims surrounding whitespace from the declaration', async () => {
    stubWorkingPath({ targetJurisdiction: ' SG ' });
    const result = await resolveAudienceJurisdiction('tenant-1');
    expect(result).toBe('SG');
  });

  it('returns null when the tenant never declared a jurisdiction', async () => {
    stubWorkingPath({});

    // Unknown must stay unknown. Returning a permissive guess here would let
    // the gate publish regulated content into a jurisdiction that forbids it.
    const result = await resolveAudienceJurisdiction('tenant-1');
    expect(result).toBeNull();
  });

  it('returns null when other geo settings exist but no jurisdiction was declared', async () => {
    stubWorkingPath({ audienceCountries: ['VN', 'SG'] });
    const result = await resolveAudienceJurisdiction('tenant-1');
    expect(result).toBeNull();
  });

  it('treats an empty-string declaration as undeclared', async () => {
    stubWorkingPath({ targetJurisdiction: '' });
    const result = await resolveAudienceJurisdiction('tenant-1');
    expect(result).toBeNull();
  });

  it('treats a whitespace-only declaration as undeclared', async () => {
    stubWorkingPath({ targetJurisdiction: '   ' });
    const result = await resolveAudienceJurisdiction('tenant-1');
    expect(result).toBeNull();
  });

  it('returns null when the declared value is null or undefined', async () => {
    stubWorkingPath({ targetJurisdiction: null });
    expect(await resolveAudienceJurisdiction('tenant-1')).toBeNull();

    stubWorkingPath({ targetJurisdiction: undefined });
    expect(await resolveAudienceJurisdiction('tenant-1')).toBeNull();
  });

  it('returns null and skips the settings read when no D1 binding is available', async () => {
    mockGetD1.mockResolvedValue(null);

    const result = await resolveAudienceJurisdiction('tenant-1');

    expect(result).toBeNull();
    expect(mockGetOrDefault).not.toHaveBeenCalled();
  });

  it('returns null when the settings read fails', async () => {
    mockGetD1.mockResolvedValue(makeDb());
    mockGetOrDefault.mockRejectedValue(new Error('D1_ERROR: no such table: tenant_settings'));

    // A database outage must surface as "unknown jurisdiction" for the gate,
    // never as an escaping exception that would abort a publish campaign.
    const result = await resolveAudienceJurisdiction('tenant-1');
    expect(result).toBeNull();
  });
});
