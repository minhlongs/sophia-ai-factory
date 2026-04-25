// TODO: storage not available in D1 client — audio upload needs Cloudflare R2 migration
import { logger } from '@/lib/utils/logger-utility';
import { getErrorMessage } from '@/lib/utils/to-error';
import { Tier } from '@/types';
import { trackUsage, hashLicenseKey, calculateCredits, startTimer } from '@/lib/usage-metering';
import { getUsageContext } from '@/lib/usage-metering/context';
import {
  generateElevenLabsVoiceover,
  generateMockVoiceover,
  type VoiceoverOutput,
} from './elevenlabs-api-client';

export type { VoiceoverOutput } from './elevenlabs-api-client';

interface GenerateVoiceoverInput {
  text: string;
  tier: Tier;
  voiceId?: string;
  userId?: string;
  licenseKey?: string;
  licenseNonce?: string;
}

/**
 * Generates voiceover using ElevenLabs API with mock fallback.
 *
 * To use ElevenLabs:
 * 1. Sign up: https://elevenlabs.io/
 * 2. Add ELEVENLABS_API_KEY to .env
 * 3. (Optional) Add ELEVENLABS_VOICE_ID for custom voice
 */
export async function generateVoiceover(input: GenerateVoiceoverInput): Promise<VoiceoverOutput> {
  const { text, tier, voiceId, userId, licenseKey, licenseNonce } = input;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const stopTimer = startTimer();

  const context = getUsageContext();
  const finalUserId = userId || context?.userId || 'unknown';
  const finalLicenseKey = licenseKey || '';
  const finalLicenseNonce = licenseNonce || context?.licenseNonce || 'unknown';
  const licenseKeyHash = hashLicenseKey(finalLicenseKey || 'unknown');

  if (apiKey) {
    try {
      const result = await generateElevenLabsVoiceover(text, tier, apiKey, voiceId);
      await trackUsage({
        userId: finalUserId,
        licenseKeyHash,
        licenseNonce: finalLicenseNonce,
        service: 'elevenlabs',
        endpoint: `/text-to-speech/${voiceId || 'default'}`,
        action: 'text_to_speech',
        creditsUsed: calculateCredits('elevenlabs', 'textToSpeech', undefined, tier),
        tierAtRequest: tier,
        statusCode: 200,
        responseTimeMs: stopTimer(),
      });
      return result;
    } catch (error) {
      const errMsg = getErrorMessage(error);
      logger.warn('[ElevenLabs] API failed, falling back to mock', { error: errMsg });
      await trackUsage({
        userId: finalUserId,
        licenseKeyHash,
        licenseNonce: finalLicenseNonce,
        service: 'elevenlabs',
        endpoint: `/text-to-speech/${voiceId || 'default'}`,
        action: 'text_to_speech',
        tierAtRequest: tier,
        statusCode: 500,
        errorMessage: errMsg,
        responseTimeMs: stopTimer(),
        creditsUsed: 0,
      });
    }
  }

  // Mock fallback
  const mockResult = await generateMockVoiceover(text, tier);
  await trackUsage({
    userId: finalUserId,
    licenseKeyHash: 'mock',
    licenseNonce: finalLicenseNonce,
    service: 'elevenlabs',
    endpoint: '/mock',
    action: 'text_to_speech_mock',
    creditsUsed: 0,
    tierAtRequest: tier,
    statusCode: 200,
    responseTimeMs: stopTimer(),
  });

  return mockResult;
}
