/**
 * bundle-publisher.test.ts — Tests for publishToBundle orchestration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// Mock logger
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { publishToBundle } from '../bundle-publisher';

function mockFetchSuccess(jobId: string) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ jobIds: [jobId] }),
  } as Response);
}

function mockFetchError(status: number, errorMsg: string) {
  fetchMock.mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error: errorMsg }),
  } as Response);
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe('publishToBundle — vietnam bundle', () => {
  it('schedules all 3 connected vietnam channels successfully', async () => {
    mockFetchSuccess('job-1');

    const result = await publishToBundle({
      videoId: 'video-123',
      bundleId: 'vietnam',
      caption: 'Test caption',
      activeProviders: new Set(['zalo', 'facebook', 'telegram']),
    });

    expect(result.successCount).toBe(3);
    expect(result.skippedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.channels).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('skips not-connected channels', async () => {
    mockFetchSuccess('job-1');

    const result = await publishToBundle({
      videoId: 'video-123',
      bundleId: 'vietnam',
      caption: 'Test caption',
      activeProviders: new Set(['facebook']), // only facebook connected
    });

    expect(result.successCount).toBe(1);
    expect(result.skippedCount).toBe(2); // zalo + telegram not connected
    const skipped = result.channels.filter((c) => c.status === 'skipped');
    expect(skipped.map((c) => c.provider)).toContain('zalo');
    expect(skipped.map((c) => c.provider)).toContain('telegram');
    expect(skipped.every((c) => c.skipReason === 'not_connected')).toBe(true);
  });

  it('returns all skipped when no channels connected', async () => {
    const result = await publishToBundle({
      videoId: 'video-123',
      bundleId: 'vietnam',
      caption: 'Test',
      activeProviders: new Set([]),
    });

    expect(result.successCount).toBe(0);
    expect(result.skippedCount).toBe(3);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('publishToBundle — crypto compliance', () => {
  it('skips zalo for crypto offer (VN-audience channel, always banned)', async () => {
    mockFetchSuccess('job-2');

    const result = await publishToBundle({
      videoId: 'vid-crypto',
      bundleId: 'vietnam',
      caption: 'Crypto offer caption',
      activeProviders: new Set(['zalo', 'facebook', 'telegram']),
      offerVertical: 'crypto',
      jurisdiction: 'US',
    });

    const zaloResult = result.channels.find((c) => c.provider === 'zalo');
    expect(zaloResult?.status).toBe('skipped');
    expect(zaloResult?.skipReason).toBeDefined();
    // facebook and telegram should be scheduled (crypto allowed in US on these)
    const facebookResult = result.channels.find((c) => c.provider === 'facebook');
    expect(facebookResult?.status).toBe('success');
  });

  it('skips all channels for VN jurisdiction crypto offer', async () => {
    const result = await publishToBundle({
      videoId: 'vid-vn',
      bundleId: 'global',
      caption: 'Crypto in VN',
      activeProviders: new Set(['youtube', 'tiktok', 'instagram', 'pinterest']),
      offerVertical: 'crypto',
      jurisdiction: 'VN',
    });

    expect(result.successCount).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.channels.every((c) => c.status === 'skipped')).toBe(true);
  });

  it('injects crypto disclaimer into caption for US jurisdiction channels', async () => {
    let capturedBody: unknown;
    fetchMock.mockImplementation(async (_url: string, opts: { body?: string }) => {
      capturedBody = JSON.parse(opts.body ?? '{}');
      return { ok: true, json: async () => ({ jobIds: ['job-cap'] }) };
    });

    await publishToBundle({
      videoId: 'vid-cap',
      bundleId: 'global',
      caption: 'Great crypto deal',
      activeProviders: new Set(['youtube']),
      offerVertical: 'crypto',
      jurisdiction: 'US',
      locale: 'en',
    });

    const body = capturedBody as { caption?: string };
    // Disclaimer must be prepended
    expect(body.caption).toBeDefined();
    expect(body.caption).toContain('#ad');
    expect(body.caption).toContain('Great crypto deal');
  });

  it('does NOT inject disclaimer for non-crypto vertical', async () => {
    let capturedBody: unknown;
    fetchMock.mockImplementation(async (_url: string, opts: { body?: string }) => {
      capturedBody = JSON.parse(opts.body ?? '{}');
      return { ok: true, json: async () => ({ jobIds: ['job-no-disc'] }) };
    });

    await publishToBundle({
      videoId: 'vid-ecom',
      bundleId: 'global',
      caption: 'Best product ever',
      activeProviders: new Set(['youtube']),
      offerVertical: 'ecommerce',
      jurisdiction: 'US',
    });

    const body = capturedBody as { caption?: string };
    expect(body.caption).toBe('Best product ever');
  });
});

describe('publishToBundle — API failure handling', () => {
  it('marks channel as failed when API returns error', async () => {
    mockFetchError(500, 'Internal server error');

    const result = await publishToBundle({
      videoId: 'vid-err',
      bundleId: 'professional',
      caption: 'Test',
      activeProviders: new Set(['linkedin', 'twitter', 'threads']),
    });

    expect(result.failedCount).toBe(3);
    expect(result.successCount).toBe(0);
    const failed = result.channels.filter((c) => c.status === 'failed');
    expect(failed.every((c) => c.errorMessage !== undefined)).toBe(true);
  });

  it('handles partial success — some channels succeed, some fail', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobIds: ['job-ok'] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ error: 'Channel not connected' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobIds: ['job-ok-2'] }),
      } as Response);

    const result = await publishToBundle({
      videoId: 'vid-partial',
      bundleId: 'professional',
      caption: 'Test',
      activeProviders: new Set(['linkedin', 'twitter', 'threads']),
    });

    expect(result.successCount).toBe(2);
    expect(result.failedCount).toBe(1);
  });

  it('handles network error gracefully', async () => {
    fetchMock.mockRejectedValue(new Error('Network failure'));

    const result = await publishToBundle({
      videoId: 'vid-net',
      bundleId: 'vietnam',
      caption: 'Test',
      activeProviders: new Set(['facebook']),
    });

    const fbResult = result.channels.find((c) => c.provider === 'facebook');
    expect(fbResult?.status).toBe('failed');
    expect(fbResult?.errorMessage).toContain('Network failure');
  });
});

describe('publishToBundle — maximum bundle', () => {
  it('calls fetch for each connected channel in maximum bundle', async () => {
    mockFetchSuccess('job-max');

    const active = new Set(['youtube', 'tiktok', 'linkedin', 'facebook']);

    const result = await publishToBundle({
      videoId: 'vid-max',
      bundleId: 'maximum',
      caption: 'Max reach',
      activeProviders: active,
    });

    expect(result.successCount).toBe(4);
    // 13 total - 4 connected = 9 skipped (not_connected)
    expect(result.skippedCount).toBe(9);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
