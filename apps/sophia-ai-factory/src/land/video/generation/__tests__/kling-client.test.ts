import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KlingVideoClient, KlingVideoClientError } from '../kling-client';

describe('KlingVideoClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('instantiates properly and constructs endpoints', () => {
    const client = new KlingVideoClient({ apiKey: 'test-key' });
    expect(client).toBeInstanceOf(KlingVideoClient);
  });

  it('throws KlingVideoClientError on failure responses', async () => {
    const client = new KlingVideoClient({ apiKey: 'test-key', baseUrl: 'https://mock.fal.run' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Quota exceeded' }), { status: 402 }),
    );

    await expect(
      client.generateVideo({ prompt: 'cinematic video of a dragon' }),
    ).rejects.toThrow(KlingVideoClientError);
  });
});
