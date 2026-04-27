/**
 * Tests for affiliate short-link redirect handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/affiliate-shortlink/short-code-generator', () => ({
  isValidShortCode: vi.fn(),
}));

vi.mock('@/lib/affiliate-shortlink/click-logger', () => ({
  logClick: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  createServerClient: vi.fn(),
}));

import { GET } from './route';
import { isValidShortCode } from '@/lib/affiliate-shortlink/short-code-generator';
import { logClick } from '@/lib/affiliate-shortlink/click-logger';
import { createServerClient } from '@/lib/db/client';
import { NextRequest } from 'next/server';

const mockSingle = vi.fn();
const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

function makeRequest(path = '/api/r/abc123def', headers: Record<string, string> = {}): NextRequest {
  const req = new NextRequest(`https://sophia.agencyos.network${path}`, { headers });
  return req;
}

describe('GET /api/r/[code]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createServerClient).mockReturnValue({ from: mockFrom } as ReturnType<typeof createServerClient>);
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it('redirects to homepage for invalid short code', async () => {
    vi.mocked(isValidShortCode).mockReturnValue(false);

    const res = await GET(makeRequest(), { params: { code: 'INVALID!!!' } });

    expect(res.status).toBe(302);
    // Should redirect to homepage (NEXT_PUBLIC_APP_URL or fallback)
    expect(res.headers.get('location')).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('redirects to homepage when offer not found in D1', async () => {
    vi.mocked(isValidShortCode).mockReturnValue(true);
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const res = await GET(makeRequest(), { params: { code: 'abc123defghij' } });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBeTruthy();
  });

  it('redirects to affiliate URL with tid on valid code', async () => {
    vi.mocked(isValidShortCode).mockReturnValue(true);
    mockSingle.mockResolvedValue({
      data: {
        campaign_id: 'camp-1',
        user_id: 'user-1',
        offer_id: 'phenq',
        affiliate_link: 'https://phenq.hoplink.com/affiliate',
      },
      error: null,
    });

    const res = await GET(makeRequest(), { params: { code: 'abc123defghij' } });

    expect(res.status).toBe(302);
    const location = res.headers.get('location')!;
    expect(location).toContain('phenq.hoplink.com');
    expect(location).toContain('tid=');
  });

  it('appends tid as max 24 chars to affiliate URL', async () => {
    vi.mocked(isValidShortCode).mockReturnValue(true);
    mockSingle.mockResolvedValue({
      data: {
        campaign_id: 'camp-1',
        user_id: 'user-1',
        offer_id: 'phenq',
        affiliate_link: 'https://phenq.hoplink.com/affiliate',
      },
      error: null,
    });

    const res = await GET(makeRequest(), { params: { code: 'abc123defghij' } });

    const location = res.headers.get('location')!;
    const url = new URL(location);
    const tid = url.searchParams.get('tid')!;
    expect(tid.length).toBeLessThanOrEqual(24);
  });

  it('fires logClick without blocking redirect', async () => {
    vi.mocked(isValidShortCode).mockReturnValue(true);
    mockSingle.mockResolvedValue({
      data: {
        campaign_id: 'camp-1',
        user_id: 'user-1',
        offer_id: 'phenq',
        affiliate_link: 'https://phenq.hoplink.com/affiliate',
      },
      error: null,
    });

    const req = makeRequest('/api/r/abc123defghij', {
      'cf-connecting-ip': '10.0.0.1',
      'cf-ipcountry': 'VN',
      'user-agent': 'TestBot/1.0',
      'referer': 'https://youtube.com',
    });

    await GET(req, { params: { code: 'abc123defghij' } });

    expect(logClick).toHaveBeenCalledWith(expect.objectContaining({
      campaignId: 'camp-1',
      userId: 'user-1',
      offerId: 'phenq',
      shortCode: 'abc123defghij',
      ip: '10.0.0.1',
      country: 'VN',
      userAgent: 'TestBot/1.0',
      referer: 'https://youtube.com',
    }));
  });

  it('queries D1 by short_code', async () => {
    vi.mocked(isValidShortCode).mockReturnValue(true);
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

    await GET(makeRequest(), { params: { code: 'abc123defghij' } });

    expect(mockFrom).toHaveBeenCalledWith('affiliate_offers_selected');
    expect(mockEq).toHaveBeenCalledWith('short_code', 'abc123defghij');
  });
});
