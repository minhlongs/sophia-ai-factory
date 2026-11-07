import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lookupUserApiKey: vi.fn(),
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  lookupUserApiKey: mocks.lookupUserApiKey,
}));
vi.mock('@/tree/video/radar/model-radar-scorer', () => ({
  rankModelsForTask: vi.fn(() => [
    { aggregator: 'fal-ai', modelId: 'wan-video' },
    { aggregator: 'replicate', modelId: 'svd' },
  ]),
}));
vi.mock('./fal-aggregator-client', () => ({ submitFalVideoJob: vi.fn() }));
vi.mock('./replicate-aggregator-client', () => ({ submitReplicateVideoJob: vi.fn() }));

import { routeVideoGenerationJob } from './unified-video-router';

const request = {
  userId: 'user-1',
  sceneTask: 'text-to-video',
} as unknown as Parameters<typeof routeVideoGenerationJob>[0];

describe('routeVideoGenerationJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['STORE_UNAVAILABLE', 'DECRYPT_FAILED', 'KEY_VERSION_UNSUPPORTED'])(
    'reports a distinct failure code instead of a missing-key code for %s',
    async (code) => {
      mocks.lookupUserApiKey.mockResolvedValue({ status: code });

      const result = await routeVideoGenerationJob(request);

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error.code).toBe(`BYOK_${code}`);
      expect(result.ok === false && result.error.message).toBe('Unable to load stored BYOK credentials');
    },
  );

  it('returns a failure result when neither aggregator credential is stored', async () => {
    mocks.lookupUserApiKey.mockResolvedValue({ status: 'NOT_CONFIGURED' });

    const result = await routeVideoGenerationJob(request);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.code).toBe('BYOK_KEY_MISSING');
  });
});
