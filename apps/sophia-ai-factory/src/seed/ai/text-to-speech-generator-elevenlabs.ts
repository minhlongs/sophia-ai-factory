import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { Tier } from '@/seed/types';
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

interface UsageTrackingDeps {
  resolveApiKey?: (userId: string, provider: string, fallback?: string) => Promise<string | null>;
  trackUsage?: (data: Record<string, unknown>) => Promise<void>;
  hashLicenseKey?: (key: string) => string;
  calculateCredits?: (service: string, action: string, _tokens?: number, tier?: Tier) => number;
  startTimer?: () => () => number;
  getUsageContext?: () => { userId?: string; licenseNonce?: string };
  withTimeout?: (url: string, options: RequestInit & { provider?: string }) => Promise<Response>;
  uploadToR2?: (data: ArrayBuffer, mime: string, key: string) => Promise<string>;
  /** When false, never fall back to process.env.ELEVENLABS_API_KEY (strict BYOK). */
  allowEnvFallback?: boolean;
  /** When false, throw on missing key or provider failure instead of returning mock audio. */
  allowMockFallback?: boolean;
}

/**
 * Generates voiceover using ElevenLabs API with mock fallback.
 *
 * @param deps - Injected dependencies to avoid static layer-boundary imports.
 */
export async function generateVoiceover(
  input: GenerateVoiceoverInput,
  deps?: UsageTrackingDeps,
): Promise<VoiceoverOutput> {
  const { text, tier, voiceId, userId, licenseKey, licenseNonce } = input;
  const context = deps?.getUsageContext?.();
  const finalUserId = userId || context?.userId || 'unknown';
  const envFallback = deps?.allowEnvFallback === false ? undefined : process.env.ELEVENLABS_API_KEY;
  const apiKey = deps?.resolveApiKey
    ? await deps.resolveApiKey(finalUserId, 'elevenlabs', envFallback)
    : (envFallback || null);
  const stopTimer = deps?.startTimer?.();

  const finalLicenseKey = licenseKey || '';
  const finalLicenseNonce = licenseNonce || context?.licenseNonce || 'unknown';
  const licenseKeyHash = deps?.hashLicenseKey?.(finalLicenseKey || 'unknown') || 'unknown';

  if (apiKey) {
    try {
      const result = await generateElevenLabsVoiceover(text, tier, apiKey, voiceId, {
        withTimeout: deps?.withTimeout,
        uploadToR2: deps?.uploadToR2,
        userId: finalUserId,
      });
      if (deps?.trackUsage) {
        await deps.trackUsage({
          userId: finalUserId,
          licenseKeyHash,
          licenseNonce: finalLicenseNonce,
          service: 'elevenlabs',
          endpoint: `/text-to-speech/${voiceId || 'default'}`,
          action: 'text_to_speech',
          creditsUsed: deps.calculateCredits?.('elevenlabs', 'textToSpeech', undefined, tier) ?? 0,
          tierAtRequest: tier,
          statusCode: 200,
          responseTimeMs: stopTimer?.(),
        });
      }
      return { ...result, provider: 'elevenlabs', isMock: false };
    } catch (error) {
      const errMsg = getErrorMessage(error);
      logger.warn('[ElevenLabs] API failed, falling back to mock', { error: errMsg });
      if (deps?.trackUsage) {
        await deps.trackUsage({
          userId: finalUserId,
          licenseKeyHash,
          licenseNonce: finalLicenseNonce,
          service: 'elevenlabs',
          endpoint: `/text-to-speech/${voiceId || 'default'}`,
          action: 'text_to_speech',
          tierAtRequest: tier,
          statusCode: 500,
          errorMessage: errMsg,
          responseTimeMs: stopTimer?.(),
          creditsUsed: 0,
        });
      }
      if (deps?.allowMockFallback === false) {
        throw error;
      }
    }
  } else if (deps?.allowMockFallback === false) {
    throw new Error('BYOK_VOICE_KEY_MISSING: No ElevenLabs BYOK API key configured for this workspace');
  }

  const mockResult = await generateMockVoiceover(text, tier);
  if (deps?.trackUsage) {
    await deps.trackUsage({
      userId: finalUserId,
      licenseKeyHash: 'mock',
      licenseNonce: finalLicenseNonce,
      service: 'elevenlabs',
      endpoint: '/mock',
      action: 'text_to_speech_mock',
      creditsUsed: 0,
      tierAtRequest: tier,
      statusCode: 200,
      responseTimeMs: stopTimer?.(),
    });
  }

  return { ...mockResult, provider: 'mock', isMock: true };
}
