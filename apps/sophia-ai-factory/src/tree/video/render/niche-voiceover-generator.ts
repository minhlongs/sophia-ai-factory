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
import { lookupUserApiKey, type UserApiKeyLookupResult } from '@/tree/byok/user-api-key-store';

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
  /** Status-aware resolver. When supplied it wins over `resolveByokKey`, so a
   *  store failure can be told apart from a genuinely absent key. */
  resolveByokKeyStatus?: (ownerId: string) => Promise<UserApiKeyLookupResult>;
  synthesize?: typeof generateVoiceover;
}

const VOICE_PRESETS = {
  en: '21m00Tcm4TlvDq8ikWAM', // Rachel - energetic, authoritative
  vi: 'ThT5KcBeYPX3keUQqHPh', // Dorothy / Vietnamese adapted neutral
};

type VoiceKeyResolution =
  | { status: 'FOUND'; key: string }
  | { status: 'MISSING' }
  | { status: 'STORE_FAILED' };

/**
 * Resolve the workspace's ElevenLabs key.
 *
 * Prefers the status-aware resolver, which can tell a store or decryption
 * failure from a genuinely absent key. The legacy `resolveByokKey` dep returns
 * a bare key or null and cannot convey a failure, so it keeps its existing
 * meaning: null is "no usable key".
 */
async function resolveTenantVoiceByokKey(
  userId: string,
  tenantId: string | undefined,
  deps?: NicheVoiceoverDeps,
): Promise<VoiceKeyResolution> {
  const statusResolver = deps?.resolveByokKeyStatus;
  const keyResolver = deps?.resolveByokKey;
  const owners = tenantId && tenantId !== userId ? [userId, tenantId] : [userId];

  let storeFailed = false;
  for (const owner of owners) {
    if (statusResolver) {
      const result = await statusResolver(owner);
      if (result.status === 'FOUND') {
        const key = result.key?.trim();
        if (key) return { status: 'FOUND', key };
        continue;
      }
      if (result.status !== 'NOT_CONFIGURED') storeFailed = true;
      continue;
    }

    if (keyResolver) {
      const legacyKey = await keyResolver(owner);
      if (legacyKey && legacyKey.trim().length > 0) {
        return { status: 'FOUND', key: legacyKey.trim() };
      }
      continue;
    }

    const lookup = await lookupUserApiKey(owner, 'elevenlabs');
    if (lookup.status === 'FOUND') {
      const key = lookup.key?.trim();
      if (key) return { status: 'FOUND', key };
    } else if (lookup.status !== 'NOT_CONFIGURED') {
      storeFailed = true;
    }
  }

  return storeFailed ? { status: 'STORE_FAILED' } : { status: 'MISSING' };
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

  const voiceKey = await resolveTenantVoiceByokKey(userId, tenantId, deps);
  if (voiceKey.status !== 'FOUND') {
    // A store failure is not "no key connected": the caller must not read it
    // as a prompt to ask the customer for credentials that may already exist.
    const storeFailed = voiceKey.status === 'STORE_FAILED';
    logger.warn('generateNicheCampaignVoiceover: no usable tenant BYOK voice key', {
      planId, userId, tenantId: tenantId ?? null, storeFailed,
    });
    return {
      success: false,
      provider: 'mock',
      error: storeFailed
        ? 'CREDENTIALS_MISSING: ElevenLabs BYOK key could not be loaded for this workspace'
        : 'CREDENTIALS_MISSING: No ElevenLabs BYOK API key connected for this workspace',
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
      { resolveApiKey: async () => voiceKey.key, allowEnvFallback: false, allowMockFallback: false },
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
