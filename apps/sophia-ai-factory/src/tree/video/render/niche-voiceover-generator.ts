/**
 * Niche Voiceover Generator
 *
 * Orchestrates text-to-speech synthesis for niche video campaigns
 * using ElevenLabs BYOK credentials with automated locale mapping.
 * Layer: tree (domain reusable logic)
 * @module tree/video/render/niche-voiceover-generator
 */

import { generateVoiceover, type VoiceoverOutput } from '@/seed/ai/text-to-speech-generator-elevenlabs';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface GenerateNicheVoiceoverInput {
  planId: string;
  userId: string;
  narrationText: string;
  locale?: 'en' | 'vi';
  voiceId?: string;
}

export interface NicheVoiceoverResult {
  success: boolean;
  audioUrl?: string;
  durationSec?: number;
  provider: 'elevenlabs' | 'mock';
  error?: string;
}

// Recommended voice presets for high-converting marketing content
const VOICE_PRESETS = {
  en: '21m00Tcm4TlvDq8ikWAM', // Rachel - energetic, authoritative
  vi: 'ThT5KcBeYPX3keUQqHPh', // Dorothy / Vietnamese adapted neutral
};

export async function generateNicheCampaignVoiceover(
  input: GenerateNicheVoiceoverInput,
): Promise<NicheVoiceoverResult> {
  const { planId, userId, narrationText, locale = 'en', voiceId } = input;
  const selectedVoice = voiceId || VOICE_PRESETS[locale] || VOICE_PRESETS.en;

  logger.info('generateNicheCampaignVoiceover: generating voiceover', {
    planId,
    userId,
    locale,
    textLength: narrationText.length,
  });

  try {
    const output: VoiceoverOutput = await generateVoiceover({
      text: narrationText,
      tier: 'PREMIUM',
      voiceId: selectedVoice,
      userId,
    });

    return {
      success: true,
      audioUrl: output.audio_url,
      durationSec: output.duration,
      provider: 'elevenlabs',
    };
  } catch (err: unknown) {
    const error = toError(err);
    logger.warn('generateNicheCampaignVoiceover: ElevenLabs generation failed, falling back', {
      planId,
      error: error.message,
    });

    return {
      success: false,
      provider: 'mock',
      error: error.message,
    };
  }
}
