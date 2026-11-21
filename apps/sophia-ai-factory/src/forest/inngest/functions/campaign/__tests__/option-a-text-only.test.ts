import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CampaignCreatedEventData } from '../types';

const mocks = vi.hoisted(() => ({
  checkCampaignIdempotency: vi.fn(),
  loadCampaignAffiliateOffer: vi.fn(),
  enforceMidFlightTier: vi.fn(),
  resolveCampaignAbTitle: vi.fn(),
  runGenerateScript: vi.fn(),
  runGenerateVoiceover: vi.fn(),
  runStartVideo: vi.fn(),
  runPollVideo: vi.fn(),
  runDistribution: vi.fn(),
  getD1ForWebhooks: vi.fn(),
  updateCampaignStatus: vi.fn(),
  markEngineMissionFailed: vi.fn(),
  notifyRefundRequired: vi.fn(),
  notifyProviderError: vi.fn(),
  notifyUserByTelegram: vi.fn(),
  resolveUserTier: vi.fn(),
  checkpoint: vi.fn(),
  clearCheckpoints: vi.fn(),
  captureServer: vi.fn(),
  emitWebhook: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: mocks.loggerWarn, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn().mockImplementation((config, trigger, handler) => ({
      config,
      trigger,
      fn: handler,
    })),
  },
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: mocks.resolveUserTier,
}));

vi.mock('@/tree/gateway/smart-resume-engine', () => ({
  SmartResumeEngine: class MockSmartResumeEngine {
    checkpoint = mocks.checkpoint;
    clearCheckpoints = mocks.clearCheckpoints;
  },
}));

vi.mock('@/tree/telegram/user-notifier', () => ({
  notifyUserByTelegram: mocks.notifyUserByTelegram,
}));

vi.mock('../campaign-pipeline-steps', () => ({
  checkCampaignIdempotency: mocks.checkCampaignIdempotency,
  loadCampaignAffiliateOffer: mocks.loadCampaignAffiliateOffer,
  enforceMidFlightTier: mocks.enforceMidFlightTier,
  resolveCampaignAbTitle: mocks.resolveCampaignAbTitle,
}));

vi.mock('../step-prompt-runner', () => ({
  runGenerateScript: mocks.runGenerateScript,
  runGenerateVoiceover: mocks.runGenerateVoiceover,
}));

vi.mock('../asset-dispatcher', () => ({
  runStartVideo: mocks.runStartVideo,
  runPollVideo: mocks.runPollVideo,
  runDistribution: mocks.runDistribution,
  getD1ForWebhooks: mocks.getD1ForWebhooks,
}));

vi.mock('@/land/video/generation/generate-campaign-db', () => ({
  updateCampaignStatus: mocks.updateCampaignStatus,
  markEngineMissionFailed: mocks.markEngineMissionFailed,
}));

vi.mock('@/land/video/generation/generate-campaign-refund-notify', () => ({
  notifyRefundRequired: mocks.notifyRefundRequired,
  notifyProviderError: mocks.notifyProviderError,
}));

vi.mock('@/forest/telemetry/posthog-capture', () => ({
  captureServer: mocks.captureServer,
}));

vi.mock('@/land/webhooks/emitter', () => ({
  emit: mocks.emitWebhook,
}));

import { generateCampaign } from '../campaign-function';
import { runFinalizeTextOnlyCampaign } from '../campaign-finalizer';

type CapturedHandler = (ctx: {
  event: { data: CampaignCreatedEventData };
  step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> };
}) => Promise<unknown>;

const mockScript = {
  title: 'Option A Pilot Launch Script',
  scenes: [
    {
      scene_number: 1,
      visual_description: 'Founder desk setup with clean metrics dashboard',
      narration: 'Stop burning cloud render budgets before validating your offer.',
      duration_estimate: 6,
    },
    {
      scene_number: 2,
      visual_description: 'Structured campaign script exported in Markdown',
      narration: 'Sophia Option A delivers conversion-ready scripts in seconds.',
      duration_estimate: 8,
    },
  ],
  total_duration: 14,
};

describe('generateCampaign — Option A Text-Only Terminal Branch (#1)', () => {
  const executedSteps: string[] = [];
  const step = {
    run: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      executedSteps.push(name);
      return fn();
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    executedSteps.length = 0;
    mocks.markEngineMissionFailed.mockResolvedValue(undefined);

    mocks.checkCampaignIdempotency.mockResolvedValue({ shouldSkip: false });
    mocks.loadCampaignAffiliateOffer.mockResolvedValue(null);
    mocks.runGenerateScript.mockResolvedValue(mockScript);
    mocks.updateCampaignStatus.mockResolvedValue(undefined);
    mocks.notifyUserByTelegram.mockResolvedValue(undefined);
    mocks.checkpoint.mockResolvedValue(undefined);
    mocks.clearCheckpoints.mockResolvedValue(undefined);
    mocks.captureServer.mockResolvedValue(undefined);
    mocks.getD1ForWebhooks.mockReturnValue(null);
  });

  it('completes BASIC (Option A) campaigns text-only with persisted script and 0 video/voiceover/distribution calls', async () => {
    const handler = (generateCampaign as unknown as { fn: CapturedHandler }).fn;

    const result = await handler({
      event: {
        data: {
          campaignId: 'camp-option-a-1',
          userId: 'user-basic-1',
          topic: 'AI Sales Automation',
          audience: 'Solo Founders',
          tier: 'BASIC',
        },
      },
      step,
    });

    expect(mocks.loadCampaignAffiliateOffer).toHaveBeenCalledWith('camp-option-a-1');
    expect(mocks.runGenerateScript).toHaveBeenCalledTimes(1);
    expect(mocks.notifyUserByTelegram).toHaveBeenCalledWith(
      'user-basic-1',
      expect.stringContaining('Your script for "AI Sales Automation" is ready for private export'),
    );
    expect(mocks.notifyUserByTelegram).toHaveBeenCalledWith(
      'user-basic-1',
      expect.stringContaining('Kịch bản cho "AI Sales Automation" đã sẵn sàng để tải xuống riêng tư'),
    );

    // Persists structured script JSON and marks campaign completed at 100%
    expect(mocks.updateCampaignStatus).toHaveBeenCalledWith(
      'camp-option-a-1',
      'completed',
      100,
      { script_content: JSON.stringify(mockScript) },
    );

    // Zero cloud video renders, zero voiceover, zero public social auto-posts
    expect(mocks.runGenerateVoiceover).not.toHaveBeenCalled();
    expect(mocks.runStartVideo).not.toHaveBeenCalled();
    expect(mocks.runPollVideo).not.toHaveBeenCalled();
    expect(mocks.runDistribution).not.toHaveBeenCalled();
    expect(executedSteps).not.toContain('generate-voiceover');
    expect(executedSteps).not.toContain('start-video-generation');
    expect(executedSteps).not.toContain('poll-video-status');
    expect(executedSteps).not.toContain('checkpoint-video-ready');
    expect(executedSteps).not.toContain('distribute-channels');

    expect(result).toEqual({
      campaignId: 'camp-option-a-1',
      status: 'completed',
      deliveryMode: 'text_only',
      script: mockScript,
      videoUrl: null,
      publicPublished: false,
    });
  });

  it('generates and completes text-only delivery when the initial Telegram notification rejects', async () => {
    mocks.notifyUserByTelegram.mockRejectedValueOnce(new Error('Telegram offline'));
    const handler = (generateCampaign as unknown as { fn: CapturedHandler }).fn;
    const result = await handler({
      event: { data: {
        campaignId: 'camp-start-notify-failure', userId: 'user-basic-1',
        topic: 'Private script', audience: 'Founders', tier: 'BASIC',
      } },
      step,
    });
    expect(mocks.loggerWarn).toHaveBeenCalledWith('[generateCampaign] Start notification failed', {
      campaignId: 'camp-start-notify-failure', error: 'Telegram offline',
    });
    expect(mocks.runGenerateScript).toHaveBeenCalledTimes(1);
    expect(mocks.updateCampaignStatus.mock.calls).toEqual([
      ['camp-start-notify-failure', 'completed', 100, { script_content: JSON.stringify(mockScript) }],
    ]);
    expect(result).toEqual({
      campaignId: 'camp-start-notify-failure', status: 'completed', deliveryMode: 'text_only',
      script: mockScript, videoUrl: null, publicPublished: false,
    });
    expect(mocks.markEngineMissionFailed).not.toHaveBeenCalled();
    expect(mocks.runGenerateVoiceover).not.toHaveBeenCalled();
    expect(mocks.runStartVideo).not.toHaveBeenCalled();
    expect(mocks.runPollVideo).not.toHaveBeenCalled();
    expect(mocks.runDistribution).not.toHaveBeenCalled();
    expect(executedSteps).not.toContain('checkpoint-video-ready');
  });

  it('retains completed text-only delivery when the completion Telegram notification fails', async () => {
    mocks.notifyUserByTelegram
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Telegram transport unavailable'));
    const handler = (generateCampaign as unknown as { fn: CapturedHandler }).fn;
    const result = await handler({
      event: { data: {
        campaignId: 'camp-notify-failure', userId: 'user-basic-1',
        topic: 'Private script', audience: 'Founders', tier: 'BASIC',
      } },
      step,
    });

    expect(mocks.notifyUserByTelegram).toHaveBeenCalledTimes(2);
    expect(mocks.updateCampaignStatus.mock.calls).toEqual([
      ['camp-notify-failure', 'completed', 100, { script_content: JSON.stringify(mockScript) }],
    ]);
    expect(result).toEqual({
      campaignId: 'camp-notify-failure', status: 'completed', deliveryMode: 'text_only',
      script: mockScript, videoUrl: null, publicPublished: false,
    });
    expect(mocks.clearCheckpoints).toHaveBeenCalledWith('camp-notify-failure');
    expect(mocks.runGenerateVoiceover).not.toHaveBeenCalled();
    expect(mocks.runStartVideo).not.toHaveBeenCalled();
    expect(mocks.runPollVideo).not.toHaveBeenCalled();
    expect(mocks.runDistribution).not.toHaveBeenCalled();
    expect(executedSteps).not.toContain('checkpoint-video-ready');
  });

  it.each(['checkpoint', 'clearCheckpoints'] as const)(
    'retains completed text delivery when %s rejects', async (operation) => {
      mocks[operation].mockRejectedValueOnce(new Error(`${operation} unavailable`));
      const handler = (generateCampaign as unknown as { fn: CapturedHandler }).fn;
      const result = await handler({
        event: { data: {
          campaignId: 'camp-housekeeping-failure', userId: 'user-basic-1',
          topic: 'Private script', audience: 'Founders', tier: 'BASIC',
        } },
        step,
      });
      expect(mocks[operation]).toHaveBeenCalledTimes(1);
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        operation === 'checkpoint'
          ? '[generateCampaign] Text-only completion checkpoint failed'
          : '[generateCampaign] Text-only checkpoint cleanup failed',
        { campaignId: 'camp-housekeeping-failure', error: `${operation} unavailable` },
      );
      expect(mocks.markEngineMissionFailed).not.toHaveBeenCalled();
      expect(mocks.clearCheckpoints).toHaveBeenCalledWith('camp-housekeeping-failure');
      expect(mocks.updateCampaignStatus.mock.calls).toEqual([
        ['camp-housekeeping-failure', 'completed', 100, { script_content: JSON.stringify(mockScript) }],
      ]);
      expect(result).toEqual({
        campaignId: 'camp-housekeeping-failure', status: 'completed', deliveryMode: 'text_only',
        script: mockScript, videoUrl: null, publicPublished: false,
      });
      expect(mocks.runGenerateVoiceover).not.toHaveBeenCalled();
      expect(mocks.runStartVideo).not.toHaveBeenCalled();
      expect(mocks.runPollVideo).not.toHaveBeenCalled();
      expect(mocks.runDistribution).not.toHaveBeenCalled();
      expect(executedSteps).not.toContain('checkpoint-video-ready');
    },
  );

  it('propagates persistence failure before attempting completion notification', async () => {
    const persistenceError = new Error('D1 write failed');
    const updateStatus = vi.fn().mockRejectedValue(persistenceError);
    const notifyUser = vi.fn();
    await expect(runFinalizeTextOnlyCampaign({
      campaignId: 'camp-db-failure', userId: 'user-basic-1', topic: 'Private script',
      script: mockScript, updateStatus, notifyUser,
      resumeEngine: {
        checkpoint: mocks.checkpoint, clearCheckpoints: mocks.clearCheckpoints,
      } as unknown as Parameters<typeof runFinalizeTextOnlyCampaign>[0]['resumeEngine'],
    })).rejects.toBe(persistenceError);
    expect(notifyUser).not.toHaveBeenCalled();
    expect(mocks.clearCheckpoints).not.toHaveBeenCalled();
  });

  it('honors explicit deliveryMode: text_only even for higher tiers', async () => {
    const handler = (generateCampaign as unknown as { fn: CapturedHandler }).fn;

    const result = await handler({
      event: {
        data: {
          campaignId: 'camp-text-explicit-1',
          userId: 'user-premium-1',
          topic: 'B2B Outreach',
          audience: 'Agency Owners',
          tier: 'PREMIUM',
          deliveryMode: 'text_only',
        },
      },
      step,
    });

    expect(mocks.runGenerateScript).toHaveBeenCalledTimes(1);
    expect(mocks.runGenerateVoiceover).not.toHaveBeenCalled();
    expect(mocks.runStartVideo).not.toHaveBeenCalled();
    expect(mocks.runPollVideo).not.toHaveBeenCalled();
    expect(mocks.runDistribution).not.toHaveBeenCalled();
    expect(result).toEqual({
      campaignId: 'camp-text-explicit-1',
      status: 'completed',
      deliveryMode: 'text_only',
      script: mockScript,
      videoUrl: null,
      publicPublished: false,
    });
  });

  it('keeps PREMIUM campaigns on the full video pipeline unchanged', async () => {
    mocks.runGenerateVoiceover.mockResolvedValue('https://r2.example.com/audio.mp3');
    mocks.runStartVideo.mockResolvedValue('video-job-1');
    mocks.runPollVideo.mockResolvedValue({
      video_url: 'https://r2.example.com/video.mp4',
      thumbnail_url: 'https://r2.example.com/thumb.jpg',
    });
    mocks.resolveUserTier.mockResolvedValue('PREMIUM');
    mocks.enforceMidFlightTier.mockResolvedValue(undefined);
    mocks.resolveCampaignAbTitle.mockResolvedValue('Premium Video Title');
    mocks.runDistribution.mockResolvedValue({
      allSucceeded: true,
      results: [{ channelId: 'youtube', success: true }],
    });

    const handler = (generateCampaign as unknown as { fn: CapturedHandler }).fn;

    const result = await handler({
      event: {
        data: {
          campaignId: 'camp-premium-1',
          userId: 'user-premium-1',
          topic: 'SaaS Growth',
          audience: 'CTOs',
          tier: 'PREMIUM',
        },
      },
      step,
    });

    expect(mocks.runGenerateScript).toHaveBeenCalledTimes(1);
    expect(mocks.runGenerateVoiceover).toHaveBeenCalledTimes(1);
    expect(mocks.runStartVideo).toHaveBeenCalledTimes(1);
    expect(mocks.runPollVideo).toHaveBeenCalledTimes(1);
    expect(mocks.runDistribution).toHaveBeenCalledTimes(1);
    expect(executedSteps).toContain('checkpoint-video-ready');
    expect(result).toEqual({ success: true, campaignId: 'camp-premium-1' });
  });
});
