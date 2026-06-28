/**
 * Tests: Edge Tracking — edge-link.ts
 *
 * Covers: createTrackingLink, recordClick, recordConversion, getTrackingLink
 * Privacy requirement: raw IP must NEVER be stored.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockSingle = vi.fn();
const mockFromChain = {
  insert: mockInsert,
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: mockSingle,
};

vi.mock('@/seed/db/client', () => ({
  getD1Client: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue(mockFromChain),
  }),
}));

// Mock Web Crypto for deterministic ID tests
const originalCrypto = globalThis.crypto;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides: Record<string, string> = {}): Request {
  const headers = new Headers({
    'cf-connecting-ip': '203.0.113.1',
    'cf-ipcountry': 'VN',
    'user-agent': 'Mozilla/5.0 Test Browser',
    referer: 'https://referring.example.com',
    ...overrides,
  });
  return new Request('https://track.sophia.agencyos.network/r/abc12345', { headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Edge Tracking — createTrackingLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockReset();
  });

  it('generates a unique 8-char base62 ID', async () => {
    const { generateShortId } = await import('../edge-link');
    const id1 = generateShortId();
    const id2 = generateShortId();
    expect(id1).toHaveLength(8);
    expect(id2).toHaveLength(8);
    expect(id1).not.toBe(id2);
    // Validate base62 charset
    expect(id1).toMatch(/^[0-9A-Za-z]{8}$/);
  });

  it('persists link with correct tenant_id and destination_url', async () => {
    const { createTrackingLink } = await import('../edge-link');
    const result = await createTrackingLink({
      tenantId: 'tenant-1',
      destinationUrl: 'https://shopee.vn/product/123?ref=sophia',
    });

    expect(result.id).toHaveLength(8);
    expect(result.shortUrl).toBe(`https://track.sophia.agencyos.network/r/${result.id}`);

    const insertCall = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertCall.tenant_id).toBe('tenant-1');
    expect(insertCall.destination_url).toBe('https://shopee.vn/product/123?ref=sophia');
    expect(insertCall.active).toBe(1);
  });

  it('stores hashed IP, NOT raw IP in recordClick', async () => {
    const { recordClick } = await import('../edge-link');
    mockSingle.mockResolvedValueOnce({
      data: { destination_url: 'https://dest.example.com', tenant_id: 'tenant-1', active: 1 },
      error: null,
    });

    await recordClick('abc12345', makeRequest());

    const insertCall = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    // ip_hash must be a hex sha256, NOT the raw IP
    expect(insertCall.ip_hash).toBeTruthy();
    expect(insertCall.ip_hash).not.toBe('203.0.113.1');
    expect(insertCall.ip_hash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex = 64 chars
    // user_agent stored
    expect(insertCall.user_agent).toContain('Mozilla/5.0 Test Browser');
    // country from CF header
    expect(insertCall.country).toBe('VN');
  });

  it('returns destination URL for 302 redirect', async () => {
    const { recordClick } = await import('../edge-link');
    mockSingle.mockResolvedValueOnce({
      data: {
        destination_url: 'https://shopee.vn/product/123',
        tenant_id: 'tenant-1',
        active: 1,
      },
      error: null,
    });

    const dest = await recordClick('abc12345', makeRequest());
    expect(dest).toBe('https://shopee.vn/product/123');
  });

  it('throws 410-equivalent error for inactive links', async () => {
    const { recordClick } = await import('../edge-link');
    mockSingle.mockResolvedValueOnce({
      data: { destination_url: 'https://dest.example.com', tenant_id: 'tenant-1', active: 0 },
      error: null,
    });

    await expect(recordClick('abc12345', makeRequest())).rejects.toThrow('Link inactive');
  });

  it('records conversion with network and amount', async () => {
    const { recordConversion } = await import('../edge-link');
    await recordConversion('abc12345', 'binance-link', {
      externalConversionId: 'conv-xyz',
      amountUsd: 15.5,
      extra: 'data',
    });

    const insertCall = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertCall.network).toBe('binance-link');
    expect(insertCall.amount_usd).toBe(15.5);
    expect(insertCall.external_conversion_id).toBe('conv-xyz');
    // raw_payload contains the full JSON payload (network is stored separately)
    expect(insertCall.raw_payload).toContain('conv-xyz');
  });

  it('denies cross-tenant link access in getTrackingLink', async () => {
    const { getTrackingLink } = await import('../edge-link');
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    const result = await getTrackingLink('tenant-other', 'abc12345');
    expect(result).toBeNull();
  });

  it('extracts country from CF-IPCountry header', async () => {
    const { recordClick } = await import('../edge-link');
    mockSingle.mockResolvedValueOnce({
      data: { destination_url: 'https://dest.example.com', tenant_id: 'tenant-1', active: 1 },
      error: null,
    });

    await recordClick('abc12345', makeRequest({ 'cf-ipcountry': 'SG' }));

    const insertCall = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertCall.country).toBe('SG');
  });

  it('handles missing IP gracefully (ip_hash is null)', async () => {
    const { recordClick } = await import('../edge-link');
    mockSingle.mockResolvedValueOnce({
      data: { destination_url: 'https://dest.example.com', tenant_id: 'tenant-1', active: 1 },
      error: null,
    });

    // Request without IP headers
    const req = new Request('https://track.sophia.agencyos.network/r/abc12345');
    await recordClick('abc12345', req);

    const insertCall = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertCall.ip_hash).toBeNull();
  });
});
