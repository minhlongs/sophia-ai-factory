import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  shouldAllowRequest: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  classifyError: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: mocks.shouldAllowRequest,
  recordSuccess: mocks.recordSuccess,
  recordFailure: mocks.recordFailure,
}));
vi.mock('@/seed/types/failure-kind', () => ({ classifyError: mocks.classifyError }));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: { info: mocks.loggerInfo } }));

import { TT_API, uploadTikTokVideo } from './tiktok-upload-helper';

const successfulResponses = (publishId = 'publish-1', uploadUrl = 'https://upload.example/video') => [
  new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
  new Response(JSON.stringify({ data: { publish_id: publishId, upload_url: uploadUrl } }), { status: 200 }),
  new Response(null, { status: 204 }),
];

describe('uploadTikTokVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldAllowRequest.mockReturnValue(true);
    mocks.classifyError.mockReturnValue('SERVER_ERROR');
  });

  it('uploads one video chunk with public visibility and returns the processing ID', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(successfulResponses()[0])
      .mockResolvedValueOnce(successfulResponses()[1])
      .mockResolvedValueOnce(successfulResponses()[2]);
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadTikTokVideo('access-token', {
      videoUrl: 'https://cdn.example/video.mp4',
      title: 'A launch video',
      description: 'Description',
      privacy: 'public',
    })).resolves.toEqual({ platformVideoId: 'publish-1', status: 'processing' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://cdn.example/video.mp4');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${TT_API}/post/publish/video/init/`);
    const init = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer access-token', 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({
      post_info: {
        title: 'A launch video',
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: 3,
        chunk_size: 3,
        total_chunk_count: 1,
      },
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe('https://upload.example/video');
    const upload = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(upload.method).toBe('PUT');
    expect(upload.headers).toEqual({ 'Content-Type': 'video/mp4', 'Content-Range': 'bytes 0-2/3' });
    expect(mocks.recordSuccess).toHaveBeenCalledExactlyOnceWith('tiktok');
    expect(mocks.recordFailure).not.toHaveBeenCalled();
  });

  it('uses private visibility for non-public posts', async () => {
    const fetchMock = vi.fn();
    for (const response of successfulResponses('publish-private')) fetchMock.mockResolvedValueOnce(response);
    vi.stubGlobal('fetch', fetchMock);

    await uploadTikTokVideo('access-token', {
      videoUrl: 'https://cdn.example/private.mp4',
      title: 'Private video',
      description: '',
      privacy: 'unlisted',
    });

    const init = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body)).post_info.privacy_level).toBe('SELF_ONLY');
  });

  it('does not call TikTok while the circuit breaker is open', async () => {
    const fetchMock = vi.fn();
    mocks.shouldAllowRequest.mockReturnValueOnce(false);
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadTikTokVideo('token', {
      videoUrl: 'https://cdn.example/video.mp4', title: 'Video', description: '',
    })).rejects.toThrow('Circuit breaker open for tiktok');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.recordFailure).not.toHaveBeenCalled();
  });

  it('records a failed source-video request once', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('missing', { status: 404 })));

    await expect(uploadTikTokVideo('token', {
      videoUrl: 'https://cdn.example/missing.mp4', title: 'Video', description: '',
    })).rejects.toThrow('Failed to fetch video');

    expect(mocks.classifyError).toHaveBeenCalledOnce();
    expect(mocks.recordFailure).toHaveBeenCalledExactlyOnceWith('tiktok', 'SERVER_ERROR');
  });

  it('records TikTok init and upload HTTP failures exactly once', async () => {
    const initFailure = vi.fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([1]), { status: 200 }))
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    vi.stubGlobal('fetch', initFailure);

    await expect(uploadTikTokVideo('token', {
      videoUrl: 'https://cdn.example/video.mp4', title: 'Video', description: '',
    })).rejects.toThrow('TikTok upload init failed: 429');

    expect(mocks.recordFailure).toHaveBeenCalledExactlyOnceWith('tiktok', 'SERVER_ERROR');

    mocks.recordFailure.mockClear();
    mocks.classifyError.mockClear();
    const uploadFailure = vi.fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([1]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { publish_id: 'publish-2', upload_url: 'https://upload.example/video' },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('upload unavailable', { status: 503 }));
    vi.stubGlobal('fetch', uploadFailure);

    await expect(uploadTikTokVideo('token', {
      videoUrl: 'https://cdn.example/video.mp4', title: 'Video', description: '',
    })).rejects.toThrow('TikTok upload failed: 503');

    expect(mocks.classifyError).toHaveBeenCalledOnce();
    expect(mocks.recordFailure).toHaveBeenCalledExactlyOnceWith('tiktok', 'SERVER_ERROR');
  });
});
