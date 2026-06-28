/**
 * Tests: URL-to-Revenue Orchestrator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { URLToRevenueRequest } from '../url-to-revenue';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn().mockResolvedValue(undefined);
const mockSingle = vi.fn();

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      insert: mockInsert,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        single: mockSingle,
      }),
    }),
  })),
}));

vi.mock('../url-product-extractor', () => ({
  extractProductInfo: vi.fn().mockResolvedValue({
    title: 'Test Product',
    description: 'A great product',
    imageUrl: 'https://example.com/img.jpg',
    price: '29.99 USD',
    canonical: 'https://example.com/product',
  }),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('URL-to-Revenue Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates HTTPS-only URL', async () => {
    const { startUrlToRevenue } = await import('../url-to-revenue');
    const req: URLToRevenueRequest = {
      url: 'http://example.com/product',
      tenantId: 'tenant-1',
      channels: ['youtube'],
    };
    await expect(startUrlToRevenue(req)).rejects.toThrow('url must be an HTTPS URL');
  });

  it('validates tenantId is required', async () => {
    const { startUrlToRevenue } = await import('../url-to-revenue');
    const req: URLToRevenueRequest = {
      url: 'https://example.com/product',
      tenantId: '',
      channels: ['youtube'],
    };
    await expect(startUrlToRevenue(req)).rejects.toThrow('tenantId is required');
  });

  it('validates channels must be non-empty', async () => {
    const { startUrlToRevenue } = await import('../url-to-revenue');
    const req: URLToRevenueRequest = {
      url: 'https://example.com/product',
      tenantId: 'tenant-1',
      channels: [],
    };
    await expect(startUrlToRevenue(req)).rejects.toThrow('channels must be a non-empty array');
  });

  it('creates job with default values applied', async () => {
    const { startUrlToRevenue } = await import('../url-to-revenue');
    const req: URLToRevenueRequest = {
      url: 'https://example.com/product',
      tenantId: 'tenant-1',
      channels: ['youtube', 'tiktok'],
    };
    const result = await startUrlToRevenue(req);
    expect(result.status).toBe('queued');
    expect(result.jobId).toBeTruthy();
    // Default 3 variants, 2 locales × 2 channels = 4 combos but capped at 3
    expect(result.variants.length).toBeLessThanOrEqual(3);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it('persists job to D1 with correct tenant_id', async () => {
    const { startUrlToRevenue } = await import('../url-to-revenue');
    await startUrlToRevenue({
      url: 'https://example.com/product',
      tenantId: 'tenant-abc',
      channels: ['instagram'],
    });
    const insertCall = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertCall.tenant_id).toBe('tenant-abc');
    expect(insertCall.status).toBe('queued');
  });

  it('retrieves job status for correct tenant', async () => {
    const { getJobStatus } = await import('../url-to-revenue');
    mockSingle.mockResolvedValueOnce({
      data: { id: 'job-1', status: 'scripting', variants_json: '[]' },
      error: null,
    });
    const result = await getJobStatus('tenant-1', 'job-1');
    expect(result.status).toBe('scripting');
    expect(result.jobId).toBe('job-1');
  });

  it('denies cross-tenant job lookup', async () => {
    const { getJobStatus } = await import('../url-to-revenue');
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'not found' },
    });
    await expect(getJobStatus('tenant-other', 'job-1')).rejects.toThrow('Job not found');
  });

  it('applies explicit variants count', async () => {
    const { startUrlToRevenue } = await import('../url-to-revenue');
    const result = await startUrlToRevenue({
      url: 'https://example.com/product',
      tenantId: 'tenant-1',
      channels: ['youtube', 'tiktok', 'instagram'],
      variants: 2,
      locales: ['vi', 'en', 'jp'],
    });
    expect(result.variants.length).toBeLessThanOrEqual(2);
  });
});
