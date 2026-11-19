import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NonRetriableError } from 'inngest';
import { MissingCredentialsError } from '@/land/services/errors';
import { ServiceFactory } from '@/land/services/factory';
import { startVideoGeneration } from '@/seed/ai/video-generator';
import { runStartVideo, type StartVideoParams } from './asset-dispatcher';

const mocks = vi.hoisted(() => ({
  getVideoService: vi.fn(),
  createVideo: vi.fn(),
  captureServer: vi.fn(),
}));

vi.mock('@/land/services/factory', () => ({
  ServiceFactory: { getVideoService: mocks.getVideoService },
}));
vi.mock('@/seed/ai/video-generator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/seed/ai/video-generator')>();
  return { ...actual, startVideoGeneration: vi.fn(actual.startVideoGeneration) };
});
vi.mock('@/forest/telemetry/posthog-capture', () => ({ captureServer: mocks.captureServer }));
vi.mock('./distribution-gateway', () => ({}));
vi.mock('./video-poller-runner', () => ({}));

function makeParams(overrides: Partial<StartVideoParams> = {}): StartVideoParams {
  return {
    campaignId: 'campaign-1',
    userId: 'user-1',
    tier: 'PREMIUM',
    script: {
      title: 'Campaign script',
      scenes: [
        { scene_number: 1, visual_description: 'Opening', narration: 'First scene.', duration_estimate: 5 },
        { scene_number: 2, visual_description: 'Closing', narration: 'Second scene.', duration_estimate: 5 },
      ],
      total_duration: 10,
    },
    updateStatus: vi.fn(async () => undefined),
    notifyUser: vi.fn(async () => undefined),
    notifyRefundRequired: vi.fn(async () => undefined),
    notifyProviderError: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('campaign video dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createVideo.mockReset().mockResolvedValue('video-job-1');
    mocks.getVideoService.mockReset().mockResolvedValue({ createVideo: mocks.createVideo });
    mocks.captureServer.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network is forbidden in this test'); }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([
    { userId: 'tenant-a-user', tier: 'BASIC' as const },
    { userId: 'tenant-b-user', tier: 'ENTERPRISE' as const },
  ])('resolves the video service for $userId and preserves $tier input', async (identity) => {
    const params = makeParams(identity);

    await expect(runStartVideo(params)).resolves.toBe('video-job-1');

    expect(startVideoGeneration).toHaveBeenCalledExactlyOnceWith(
      { script: params.script, tier: identity.tier, userId: identity.userId },
      ServiceFactory.getVideoService,
    );
    expect(mocks.getVideoService).toHaveBeenCalledExactlyOnceWith(identity.userId);
    expect(mocks.createVideo).toHaveBeenCalledExactlyOnceWith({
      avatarId: 'default_avatar_001',
      voiceId: 'en-US-1',
      script: 'First scene. Second scene.',
      title: expect.stringMatching(/^Sophia Campaign - /),
    });
    expect(params.updateStatus).toHaveBeenCalledWith('processing_video', 70);
    expect(mocks.captureServer).toHaveBeenCalledWith(expect.objectContaining({ distinctId: identity.userId }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('skips generation when resuming finalization', async () => {
    const params = makeParams({ resume: true, resumeFrom: 'finalize' });

    await expect(runStartVideo(params)).resolves.toBeNull();

    expect(startVideoGeneration).not.toHaveBeenCalled();
    expect(mocks.getVideoService).not.toHaveBeenCalled();
    expect(params.updateStatus).not.toHaveBeenCalled();
    expect(params.notifyUser).not.toHaveBeenCalled();
  });

  it('preserves missing credential refund notification from the injected factory', async () => {
    const params = makeParams();
    const error = new MissingCredentialsError('HEYGEN_API_KEY');
    mocks.getVideoService.mockRejectedValueOnce(error);

    await expect(runStartVideo(params)).rejects.toBeInstanceOf(NonRetriableError);

    expect(params.notifyRefundRequired).toHaveBeenCalledExactlyOnceWith(params.userId, params.campaignId, error.key);
    expect(mocks.createVideo).not.toHaveBeenCalled();
    expect(mocks.captureServer).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
