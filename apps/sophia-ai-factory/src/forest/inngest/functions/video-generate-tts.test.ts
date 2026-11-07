import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildProviderPool: vi.fn(),
  selectWithStrategy: vi.fn(),
  lookupUserApiKey: vi.fn(),
  resolveUserTier: vi.fn(),
  generateElevenLabsVoiceover: vi.fn(),
  emitProgress: vi.fn(),
  writeStageCheckpoint: vi.fn(),
  getFishSpeechClient: vi.fn(),
  getVideoBucket: vi.fn(),
  uploadBufferToR2: vi.fn(),
  downloadToBuffer: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/forest/quota/provider-pool', () => ({
  buildProviderPool: mocks.buildProviderPool,
}));
vi.mock('@/forest/quota/routing-strategy', () => ({
  selectWithStrategy: mocks.selectWithStrategy,
  NoProvidersAvailableError: class NoProvidersAvailableError extends Error {},
}));
vi.mock('@/tree/byok/user-api-key-store', () => ({
  lookupUserApiKey: mocks.lookupUserApiKey,
}));
vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: mocks.resolveUserTier,
}));
vi.mock('@/seed/ai/elevenlabs-api-client', () => ({
  generateElevenLabsVoiceover: mocks.generateElevenLabsVoiceover,
}));
vi.mock('./video-generate-helpers', () => ({
  emitProgress: mocks.emitProgress,
  writeStageCheckpoint: mocks.writeStageCheckpoint,
  getFishSpeechClient: mocks.getFishSpeechClient,
  getVideoBucket: mocks.getVideoBucket,
  uploadBufferToR2: mocks.uploadBufferToR2,
  downloadToBuffer: mocks.downloadToBuffer,
}));

import { executeTtsStep } from './video-generate-tts';

const baseParams = {
  userId: 'user-1',
  tenantId: 'ws_1',
  missionId: 'mission_1',
  audioR2Key: 'tenants/ws_1/mission_1/audio.mp3',
  voiceoverText: 'Script text',
  routingStrategy: 'cost-optimized',
};

describe('executeTtsStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildProviderPool.mockResolvedValue([
      { provider: 'elevenlabs', model: 'eleven_multilingual_v2', hasUserKey: true },
    ]);
    mocks.selectWithStrategy.mockReturnValue({
      provider: 'elevenlabs',
      strategy: 'cost-optimized',
    });
  });

  it('returns the ElevenLabs duration when BYOK resolution succeeds', async () => {
    mocks.lookupUserApiKey.mockResolvedValue({ status: 'FOUND', key: 'el-user-key' });
    mocks.resolveUserTier.mockResolvedValue('PREMIUM');
    mocks.generateElevenLabsVoiceover.mockResolvedValue({ duration: 12.5 });

    const result = await executeTtsStep(baseParams);

    expect(result).toEqual({ durationSec: 12.5, ttsProvider: 'elevenlabs' });
    expect(mocks.generateElevenLabsVoiceover).toHaveBeenCalledWith(
      baseParams.voiceoverText,
      'PREMIUM',
      'el-user-key',
      undefined,
      expect.objectContaining({ uploadToR2: expect.any(Function) }),
    );
    expect(mocks.getFishSpeechClient).not.toHaveBeenCalled();
  });

  it.each(['STORE_UNAVAILABLE', 'DECRYPT_FAILED', 'KEY_VERSION_UNSUPPORTED'])(
    'stops before any provider call when BYOK lookup fails with %s',
    async (code) => {
      mocks.lookupUserApiKey.mockResolvedValue({ status: code });

      await expect(executeTtsStep(baseParams)).rejects.toMatchObject({ code: `BYOK_${code}` });

      expect(mocks.getFishSpeechClient).not.toHaveBeenCalled();
      expect(mocks.generateElevenLabsVoiceover).not.toHaveBeenCalled();
      expect(mocks.uploadBufferToR2).not.toHaveBeenCalled();
      expect(mocks.downloadToBuffer).not.toHaveBeenCalled();
    },
  );
});
