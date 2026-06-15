/**
 * WanVideoClient Tests
 *
 * Covers:
 * - generateVideo: successful submission (200)
 * - getJobStatus: running → succeeded polling transition
 * - getJobStatus: returns videoUrl from array output
 * - Error handling: 429 (rate limit), 402 (payment required), 400 (bad prompt)
 * - Error handling: generic non-2xx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WanVideoClient, WanVideoClientError } from '../wan21-client';

const TEST_API_KEY = 'r8_test_key';

function makeClient(): WanVideoClient {
  return new WanVideoClient({ apiKey: TEST_API_KEY });
}

describe('WanVideoClient.generateVideo()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns jobId and status on successful submission', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'pred-123', status: 'starting', output: null, error: null }),
      }),
    );

    const client = makeClient();
    const result = await client.generateVideo({ prompt: 'A sunrise over mountains' });

    expect(result.jobId).toBe('pred-123');
    expect(result.status).toBe('starting');
  });

  it('sends POST to /models/{model}/predictions with correct body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pred-456', status: 'starting' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = makeClient();
    await client.generateVideo({ prompt: 'Test', aspectRatio: '9:16', duration: 10, seed: 42 });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/models/wan-video/wan-2.1/predictions');
    expect((options.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${TEST_API_KEY}`);

    const body = JSON.parse(options.body as string) as { input: Record<string, unknown> };
    expect(body.input.prompt).toBe('Test');
    expect(body.input.aspect_ratio).toBe('9:16');
    expect(body.input.duration).toBe(10);
    expect(body.input.seed).toBe(42);
  });

  it('throws WanVideoClientError(429) on rate limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      }),
    );

    const client = makeClient();
    await expect(client.generateVideo({ prompt: 'test' })).rejects.toThrow(WanVideoClientError);
    await expect(client.generateVideo({ prompt: 'test' })).rejects.toMatchObject({ statusCode: 429 });
  });

  it('throws WanVideoClientError(402) on payment required', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        text: async () => 'No credits',
      }),
    );

    const client = makeClient();
    await expect(client.generateVideo({ prompt: 'test' })).rejects.toMatchObject({ statusCode: 402 });
  });

  it('throws WanVideoClientError(400) on invalid prompt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid input',
      }),
    );

    const client = makeClient();
    await expect(client.generateVideo({ prompt: '' })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('WanVideoClient.getJobStatus()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns processing status when job still running', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'pred-789', status: 'processing', output: null, error: null }),
      }),
    );

    const client = makeClient();
    const status = await client.getJobStatus('pred-789');

    expect(status.status).toBe('processing');
    expect(status.videoUrl).toBeUndefined();
  });

  it('returns videoUrl when succeeded (array output)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pred-999',
          status: 'succeeded',
          output: ['https://cdn.replicate.delivery/video.mp4'],
          error: null,
        }),
      }),
    );

    const client = makeClient();
    const status = await client.getJobStatus('pred-999');

    expect(status.status).toBe('succeeded');
    expect(status.videoUrl).toBe('https://cdn.replicate.delivery/video.mp4');
  });

  it('returns videoUrl when succeeded (string output)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pred-888',
          status: 'succeeded',
          output: 'https://cdn.replicate.delivery/video-single.mp4',
          error: null,
        }),
      }),
    );

    const client = makeClient();
    const status = await client.getJobStatus('pred-888');

    expect(status.videoUrl).toBe('https://cdn.replicate.delivery/video-single.mp4');
  });

  it('returns error on failed status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pred-err',
          status: 'failed',
          output: null,
          error: 'NSFW content detected',
        }),
      }),
    );

    const client = makeClient();
    const status = await client.getJobStatus('pred-err');

    expect(status.status).toBe('failed');
    expect(status.error).toBe('NSFW content detected');
  });

  it('throws WanVideoClientError on non-2xx status response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Service unavailable',
      }),
    );

    const client = makeClient();
    await expect(client.getJobStatus('pred-xyz')).rejects.toMatchObject({ statusCode: 503 });
  });
});
