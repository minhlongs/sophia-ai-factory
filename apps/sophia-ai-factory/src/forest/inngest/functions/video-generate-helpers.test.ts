import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  shouldAllowRequest: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  classifyError: vi.fn(),
  classifyHttpStatus: vi.fn(),
  writeCheckpoint: vi.fn(),
  getVideoBucket: vi.fn(),
  wanClientCreated: vi.fn(),
  fishSpeechClientCreated: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({ inngest: { send: mocks.send } }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: mocks.loggerInfo, warn: mocks.loggerWarn, error: mocks.loggerError },
}));
vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: mocks.shouldAllowRequest,
  recordSuccess: mocks.recordSuccess,
  recordFailure: mocks.recordFailure,
}));
vi.mock('@/seed/types/failure-kind', () => ({
  classifyError: mocks.classifyError,
  classifyHttpStatus: mocks.classifyHttpStatus,
}));
vi.mock('@/forest/pipeline', () => ({
  CheckpointService: class {
    writeCheckpoint = mocks.writeCheckpoint;
  },
}));
vi.mock('@/land/video/generation/wan21-client', () => ({
  WanVideoClient: class {
    constructor(options: { apiKey: string }) {
      mocks.wanClientCreated(options);
    }
  },
}));
vi.mock('@/land/video/generation/fish-speech-client', () => ({
  FishSpeechClient: class {
    constructor(options: { apiKey: string }) {
      mocks.fishSpeechClientCreated(options);
    }
  },
}));
vi.mock('@/land/video/storage/r2-binding', () => ({ getVideoBucket: mocks.getVideoBucket }));

import {
  POLL_INTERVAL_MS,
  POLL_MAX_ATTEMPTS,
  downloadToBuffer,
  emitProgress,
  getFishSpeechClient,
  getWanClient,
  uploadBufferToR2,
  writeStageCheckpoint,
} from './video-generate-helpers';

describe('video generation helpers', () => {
  const previousWanApiKey = process.env.WAN_API_KEY;
  const previousFishSpeechApiKey = process.env.FISH_SPEECH_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WAN_API_KEY = 'wan-test-key';
    process.env.FISH_SPEECH_API_KEY = 'fish-test-key';
    mocks.shouldAllowRequest.mockReturnValue(true);
    mocks.classifyError.mockReturnValue('NETWORK');
    mocks.classifyHttpStatus.mockReturnValue('HTTP');
  });

  afterEach(() => {
    if (previousWanApiKey === undefined) delete process.env.WAN_API_KEY;
    else process.env.WAN_API_KEY = previousWanApiKey;
    if (previousFishSpeechApiKey === undefined) delete process.env.FISH_SPEECH_API_KEY;
    else process.env.FISH_SPEECH_API_KEY = previousFishSpeechApiKey;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('exports stable polling limits', () => {
    expect(POLL_INTERVAL_MS).toBe(20_000);
    expect(POLL_MAX_ATTEMPTS).toBe(18);
  });

  it('emits a timestamped campaign progress event', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);

    await emitProgress('campaign-1', 'visual', 45, 'Rendering scenes');

    expect(mocks.send).toHaveBeenCalledWith({
      id: 'progress-campaign-1-visual-1234',
      name: 'campaign.progress',
      data: {
        type: 'campaign.progress',
        campaignId: 'campaign-1',
        step: 'visual',
        progress: 45,
        message: 'Rendering scenes',
        timestamp: 1234,
      },
    });
  });

  it('writes a video checkpoint with pipeline metadata', async () => {
    await writeStageCheckpoint('pipe-1', 'compose', 'completed', 'tenant-1', { r2Key: 'video.mp4' });

    expect(mocks.writeCheckpoint).toHaveBeenCalledWith(
      'pipe-1',
      'compose',
      'completed',
      { r2Key: 'video.mp4' },
      { pipelineType: 'video_generation', error: undefined },
    );
  });

  it('keeps checkpoint failures non-fatal and logs the original error', async () => {
    mocks.writeCheckpoint.mockRejectedValueOnce(new Error('D1 unavailable'));

    await expect(writeStageCheckpoint('pipe-2', 'tts', 'failed', 'tenant-2')).resolves.toBeUndefined();

    expect(mocks.loggerWarn).toHaveBeenCalledWith('[videoGenerate] Checkpoint write failed (non-fatal)', {
      pipelineId: 'pipe-2',
      stage: 'tts',
      error: 'D1 unavailable',
    });
  });

  it('requires provider keys and creates clients with their configured key', () => {
    expect(getWanClient()).toBeDefined();
    expect(getFishSpeechClient()).toBeDefined();
    expect(mocks.wanClientCreated).toHaveBeenCalledWith({ apiKey: 'wan-test-key' });
    expect(mocks.fishSpeechClientCreated).toHaveBeenCalledWith({ apiKey: 'fish-test-key' });

    delete process.env.WAN_API_KEY;
    delete process.env.FISH_SPEECH_API_KEY;
    expect(() => getWanClient()).toThrow('WAN_API_KEY not configured');
    expect(() => getFishSpeechClient()).toThrow('FISH_SPEECH_API_KEY not configured');
  });

  it('skips an R2 upload when the video bucket is unavailable', async () => {
    mocks.getVideoBucket.mockResolvedValueOnce(null);

    await uploadBufferToR2('videos/a.mp4', new ArrayBuffer(4), 'video/mp4');

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      '[videoGenerate] R2 bucket not available — skipping upload',
      { key: 'videos/a.mp4' },
    );
  });

  it('uploads buffers to R2 with the requested content type', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    mocks.getVideoBucket.mockResolvedValueOnce({ bucket: { put } });
    const data = new ArrayBuffer(8);

    await uploadBufferToR2('videos/b.mp4', data, 'video/mp4');

    expect(put).toHaveBeenCalledWith('videos/b.mp4', data, {
      httpMetadata: { contentType: 'video/mp4' },
    });
  });

  it('downloads a buffer and records request success', async () => {
    const data = new ArrayBuffer(12);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(data, { status: 200 })));

    await expect(downloadToBuffer('https://video.example/clip.mp4')).resolves.toEqual(data);

    expect(mocks.shouldAllowRequest).toHaveBeenCalledWith('video-download');
    expect(mocks.recordSuccess).toHaveBeenCalledWith('video-download');
    expect(mocks.recordFailure).not.toHaveBeenCalled();
  });

  it('fails closed when the video download circuit breaker is open', async () => {
    const fetchMock = vi.fn();
    mocks.shouldAllowRequest.mockReturnValueOnce(false);
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloadToBuffer('https://video.example/clip.mp4')).rejects.toThrow('Circuit breaker open');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.recordFailure).not.toHaveBeenCalled();
  });

  it('classifies HTTP download failures and unexpected network errors', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockRejectedValueOnce(new Error('network reset')));

    await expect(downloadToBuffer('https://video.example/failed.mp4')).rejects.toThrow(': 503');
    expect(mocks.classifyHttpStatus).toHaveBeenCalledWith(503);
    expect(mocks.recordFailure).toHaveBeenNthCalledWith(1, 'video-download', 'HTTP');

    await expect(downloadToBuffer('https://video.example/network.mp4')).rejects.toThrow('network reset');
    expect(mocks.classifyError).toHaveBeenCalledWith(expect.any(Error));
    expect(mocks.recordFailure).toHaveBeenNthCalledWith(2, 'video-download', 'NETWORK');
  });
});
