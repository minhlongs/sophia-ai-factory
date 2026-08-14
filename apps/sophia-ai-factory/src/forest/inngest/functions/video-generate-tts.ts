/**
 * TTS step handler for video generation pipeline.
 * ElevenLabs (BYOK) → Fish Speech fallback → upload audio to R2.
 *
 * @module forest/inngest/functions/video-generate-tts
 */

import { logger } from '@/seed/utils/logger-utility';
import { selectWithStrategy, NoProvidersAvailableError } from '@/forest/quota/routing-strategy';
import type { RoutingContext } from '@/seed/config/routing-strategies';
import { generateElevenLabsVoiceover } from '@/seed/ai/elevenlabs-api-client';
import { getUserApiKey } from '@/tree/byok/user-api-key-store';
import { getUserTier } from '@/seed/db/get-user-tier';
import { buildProviderPool } from '@/forest/quota/provider-pool';
import {
  emitProgress, writeStageCheckpoint,
  getFishSpeechClient, getVideoBucket,
  uploadBufferToR2, downloadToBuffer,
} from './video-generate-helpers';

/** Parameters needed to execute the TTS step. */
export interface TtsStepParams {
  userId: string;
  tenantId: string;
  missionId: string;
  audioR2Key: string;
  voiceoverText: string;
  routingStrategy: string;
}

/** Result of TTS generation: audio duration and which provider was used. */
export interface TtsStepResult {
  durationSec: number;
  ttsProvider: string;
}

/**
 * Execute TTS generation with routing-strategy provider selection.
 * Returns audio duration in seconds and provider used. Uploads audio to R2 at `audioR2Key`.
 */
export async function executeTtsStep(params: TtsStepParams): Promise<TtsStepResult> {
  const { userId, tenantId, missionId, audioR2Key, voiceoverText, routingStrategy } = params;

  const ttsContext: RoutingContext = { taskType: 'tts', estimatedInputTokens: voiceoverText.length };
  const ttsPool = await buildProviderPool(userId, ttsContext);

  let ttsDecision: { provider: string; strategy: string } | null = null;
  if (ttsPool.length > 0) {
    try {
      const decision = selectWithStrategy(ttsPool, ttsContext, routingStrategy);
      ttsDecision = { provider: decision.provider, strategy: decision.strategy };
    } catch (err) {
      if (err instanceof NoProvidersAvailableError) {
        logger.info('[videoGenerate] No TTS providers available, falling back to Fish Speech', { strategy: routingStrategy });
        await emitProgress(missionId, 'error', 0, 'Không có nhà cung cấp khả dụng / No providers available for tts');
        await writeStageCheckpoint(missionId, 'generate_tts', 'failed', tenantId, {}, 'no_providers_available');
      } else {
        throw err;
      }
    }
  } else {
    logger.info('[videoGenerate] TTS provider pool empty, falling back to Fish Speech', { strategy: routingStrategy });
  }

  // ElevenLabs (BYOK) — preferred if selected and key available
  const hasElevenLabsKey = ttsPool.find(c => c.provider === 'elevenlabs')?.hasUserKey;
  if (ttsDecision?.provider === 'elevenlabs' && hasElevenLabsKey) {
    try {
      const elevenLabsKey = await getUserApiKey(userId, 'elevenlabs');
      if (elevenLabsKey) {
        const tier = await getUserTier(userId);
        // Upload directly to final audioR2Key and return full public URL
        const uploadToR2 = async (data: ArrayBuffer, mime: string, _key: string): Promise<string> => {
          await uploadBufferToR2(audioR2Key, data, mime);
          const ref = await getVideoBucket();
          const base = ref?.publicBaseUrl?.replace(/\/$/, '');
          if (base) {
            return `${base}/${audioR2Key}`;
          }
          // Fallback: data URI if R2 public URL not configured
          const base64 = Buffer.from(data).toString('base64');
          return `data:${mime};base64,${base64}`;
        };
        const elevenResult = await generateElevenLabsVoiceover(voiceoverText, tier, elevenLabsKey, undefined, { uploadToR2 });
        // Audio already uploaded to audioR2Key — no download/re-upload needed
        logger.info('[videoGenerate] ElevenLabs TTS complete', { audioR2Key, duration: elevenResult.duration, strategy: routingStrategy });
        return { durationSec: elevenResult.duration, ttsProvider: 'elevenlabs' };
      }
    } catch (err) {
      logger.warn('[videoGenerate] ElevenLabs TTS failed, falling back to Fish Speech', {
        strategy: routingStrategy,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Fish Speech fallback (default behavior)
  const ttsClient = getFishSpeechClient();
  const ttsResult = await ttsClient.generateSpeech({ text: voiceoverText });
  const { audioUrl, durationSec } = ttsResult;

  const audioBuffer = await downloadToBuffer(audioUrl);
  await uploadBufferToR2(audioR2Key, audioBuffer, 'audio/mpeg');

  logger.info('[videoGenerate] Audio uploaded to R2', { audioR2Key, durationSec, strategy: routingStrategy, ttsProvider: ttsDecision?.provider ?? 'fish-speech' });
  return { durationSec, ttsProvider: 'fish-speech' };
}
