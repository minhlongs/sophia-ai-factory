/**
 * Tree YouTube upload helper — labelled-fixture tests
 *
 * Proves the tree-layer uploader sends `status.containsSyntheticMedia` on the
 * resumable upload init call and blocks an upload whose provenance review left
 * claims unresolved, matching the forest and land uploaders.
 *
 * @module tree/publishing/__tests__/youtube-upload-helper
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: vi.fn(() => true),
  recordFailure: vi.fn(),
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import { uploadYoutubeVideo } from '../youtube-upload-helper';
import * as circuitBreaker from '@/seed/security/circuit-breaker';

const initResponse = () =>
  new Response(null, {
    status: 200,
    headers: { Location: 'https://upload.googleapis.test/session-tree' },
  });

const videoResponse = () => new Response(new Uint8Array([1, 2, 3]), { status: 200 });

const uploadResponse = () =>
  new Response(JSON.stringify({ id: 'yt_tree_77' }), { status: 200 });

const initBody = (fetchMock: ReturnType<typeof vi.fn>) => {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
  return JSON.parse(String(init.body)) as {
    status: { containsSyntheticMedia?: boolean; privacyStatus?: string };
  };
};

describe('uploadYoutubeVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends containsSyntheticMedia true by default', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(initResponse())
      .mockResolvedValueOnce(videoResponse())
      .mockResolvedValueOnce(uploadResponse());
    vi.stubGlobal('fetch', fetchMock);

    await uploadYoutubeVideo('token_tree', {
      videoUrl: 'https://cdn.example.test/v.mp4',
      title: 'Sophia generated clip',
      description: 'Desc',
    });

    expect(initBody(fetchMock).status.containsSyntheticMedia).toBe(true);
  });

  it('blocks the upload before calling YouTube when provenance leaves claims unresolved', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      uploadYoutubeVideo('token_tree', {
        videoUrl: 'https://cdn.example.test/v.mp4',
        title: 'Unverified claim clip',
        description: 'Desc',
        provenance: {
          claims: [
            {
              id: 'c_1',
              text: 'Guaranteed 50% yield',
              status: 'pending',
              riskLevel: 'high',
            },
          ],
        },
      }),
    ).rejects.toThrow(/PROVENANCE_BLOCKED/);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(circuitBreaker.shouldAllowRequest).not.toHaveBeenCalled();
    expect(circuitBreaker.recordFailure).not.toHaveBeenCalled();
  });
});
