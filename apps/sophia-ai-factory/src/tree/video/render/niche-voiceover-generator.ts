/**
 * Niche Voiceover Generator
 *
 * Orchestrates text-to-speech synthesis for niche video campaigns
 * using strict tenant/workspace ElevenLabs BYOK credentials.
 * Never falls back to platform environment keys or mock audio as live success.
 *
 * Layer: tree (domain reusable logic)
 * @module tree/video/render/niche-voiceover-generator
 */

import { generateVoiceover, type VoiceoverOutput } from '@/seed/ai/text-to-speech-generator-elevenlabs';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { resolveVideoPersona } from '@/tree/audience/persona-gender-resolver';
import { getUserApiKey } from '@/tree/byok/user-api-key-store';

export interface GenerateNicheVoiceoverInput {
  planId: string;
  userId: string;
  tenantId?: string;
  narrationText: string;
  locale?: 'en' | 'vi';
  voiceId?: string;
  niche?: string;
  mabPreferredGender?: 'male' | 'female';
}

export type VoiceoverFailureCode =
  | 'CREDENTIALS_MISSING'
  | 'PROVIDER_AUTH_FAILED'
  | 'PROVIDER_QUOTA_EXCEEDED'
  | 'PROVIDER_TIMEOUT'
  | 'MOCK_OUTPUT_REJECTED'
  | 'PROVIDER_FAILED';

export interface NicheVoiceoverResult {
  success: boolean;
  audioUrl?: string;
  durationSec?: number;
  provider: 'elevenlabs' | 'mock';
  error?: string;
  errorCode?: VoiceoverFailureCode;
  /** True when the HTTP request to ElevenLabs was already dispatched or may have been dispatched. */
  providerRequestDispatched?: boolean;
  /** True when the provider outcome could not be determined (timeout / network drop after dispatch). */
  outcomeUncertain?: boolean;
}

export interface NicheVoiceoverDeps {
  resolveByokKey?: (ownerId: string) => Promise<string | null>;
  synthesize?: typeof generateVoiceover;
}

const VOICE_PRESETS = {
  en: '21m00Tcm4TlvDq8ikWAM', // Rachel - energetic, authoritative
  vi: 'ThT5KcBeYPX3keUQqHPh', // Dorothy / Vietnamese adapted neutral
};

async function resolveTenantVoiceByokKey(
  userId: string,
  tenantId: string | undefined,
  customResolver?: (ownerId: string) => Promise<string | null>,
): Promise<string | null> {
  const lookup = customResolver ?? ((ownerId: string) => getUserApiKey(ownerId, 'elevenlabs'));
  if (userId) {
    const userKey = await lookup(userId);
    if (userKey && userKey.trim().length > 0) return userKey.trim();
  }
  if (tenantId && tenantId !== userId) {
    const tenantKey = await lookup(tenantId);
    if (tenantKey && tenantKey.trim().length > 0) return tenantKey.trim();
  }
  return null;
}

function classifyVoiceoverError(message: string): {
  errorCode: VoiceoverFailureCode;
  outcomeUncertain: boolean;
  providerRequestDispatched: boolean;
} {
  const lower = message.toLowerCase();
  if (lower.includes('circuit breaker')) {
    return { errorCode: 'PROVIDER_FAILED', outcomeUncertain: false, providerRequestDispatched: false };
  }
  if (lower.includes('401') || lower.includes('403') || lower.includes('invalid') || lower.includes('unauthorized')) {
    return { errorCode: 'PROVIDER_AUTH_FAILED', outcomeUncertain: false, providerRequestDispatched: true };
  }
  if (lower.includes('429') || lower.includes('402') || lower.includes('quota')) {
    return { errorCode: 'PROVIDER_QUOTA_EXCEEDED', outcomeUncertain: false, providerRequestDispatched: true };
  }
  if (/timeout|timed out|abort|econnreset|socket hang up|network|fetch failed/.test(lower)) {
    return { errorCode: 'PROVIDER_TIMEOUT', outcomeUncertain: true, providerRequestDispatched: true };
  }
  return { errorCode: 'PROVIDER_FAILED', outcomeUncertain: true, providerRequestDispatched: true };
}

export async function generateNicheCampaignVoiceover(
  input: GenerateNicheVoiceoverInput,
  deps?: NicheVoiceoverDeps,
): Promise<NicheVoiceoverResult> {
  const { planId, userId, tenantId, narrationText, locale = 'en', voiceId, niche, mabPreferredGender } = input;
  const persona = niche
    ? resolveVideoPersona({ niche, mabPreferredGender: mabPreferredGender ?? undefined })
    : null;
  const selectedVoice = voiceId || persona?.voiceProfile.id || VOICE_PRESETS[locale] || VOICE_PRESETS.en;

  const byokKey = await resolveTenantVoiceByokKey(userId, tenantId, deps?.resolveByokKey);
  if (!byokKey) {
    logger.warn('generateNicheCampaignVoiceover: missing tenant BYOK voice key', {
      planId, userId, tenantId: tenantId ?? null,
    });
    return {
      success: false,
      provider: 'mock',
      error: 'CREDENTIALS_MISSING: No ElevenLabs BYOK API key connected for this workspace',
      errorCode: 'CREDENTIALS_MISSING',
      providerRequestDispatched: false,
      outcomeUncertain: false,
    };
  }

  logger.info('generateNicheCampaignVoiceover: generating voiceover with tenant BYOK', {
    planId, userId, locale, textLength: narrationText.length,
  });

  const synthesize = deps?.synthesize ?? generateVoiceover;
  try {
    const output: VoiceoverOutput = await synthesize(
      { text: narrationText, tier: 'PREMIUM', voiceId: selectedVoice, userId: tenantId || userId },
      { resolveApiKey: async () => byokKey, allowEnvFallback: false, allowMockFallback: false },
    );

    const isMockOutput =
      output.isMock === true || output.provider === 'mock' || !output.audio_url || output.audio_url.includes('cs.uic.edu');
    if (isMockOutput) {
      logger.warn('generateNicheCampaignVoiceover: rejected mock voiceover output', { planId });
      return {
        success: false,
        provider: 'mock',
        error: 'MOCK_OUTPUT_REJECTED: Mock audio cannot be recorded as live ElevenLabs output',
        errorCode: 'MOCK_OUTPUT_REJECTED',
        providerRequestDispatched: false,
        outcomeUncertain: false,
      };
    }

    return {
      success: true,
      audioUrl: output.audio_url,
      durationSec: output.duration,
      provider: 'elevenlabs',
      providerRequestDispatched: true,
      outcomeUncertain: false,
    };
  } catch (err: unknown) {
    const error = toError(err);
    const classified = classifyVoiceoverError(error.message);
    logger.warn('generateNicheCampaignVoiceover: ElevenLabs synthesis failed', {
      planId, errorCode: classified.errorCode, outcomeUncertain: classified.outcomeUncertain, error: error.message,
    });
    return {
      success: false,
      provider: 'mock',
      error: `${classified.errorCode}: ${error.message}`,
      errorCode: classified.errorCode,
      providerRequestDispatched: classified.providerRequestDispatched,
      outcomeUncertain: classified.outcomeUncertain,
    };
  }
}
