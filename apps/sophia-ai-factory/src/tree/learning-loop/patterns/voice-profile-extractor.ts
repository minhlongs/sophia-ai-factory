/**
 * Voice Profile Extraction Helpers for Creative Pattern Extractor
 *
 * Layer: tree (domain reusable)
 * @module tree/learning-loop/patterns/voice-profile-extractor
 */

import { type VoiceProfile, VALID_VOICE_PROFILES } from './types';

function resolveVoiceProfileStyle(rawStyle: string): VoiceProfile {
  if (rawStyle && VALID_VOICE_PROFILES.has(rawStyle as VoiceProfile)) {
    return rawStyle as VoiceProfile;
  }

  const normalized = rawStyle.toLowerCase();
  if (/dynamic|hook|punchy|fast|hype|energetic/.test(normalized)) {
    return 'dynamic_hook';
  }
  if (/enthusiastic|recommender|warm|friendly|affiliate|recommend/.test(normalized)) {
    return 'enthusiastic_recommender';
  }
  if (/narrator|cinematic|story|documentary|epic|deep/.test(normalized)) {
    return 'cinematic_narrator';
  }
  return 'calm_authoritative';
}

function extractVoiceIdFromMetadata(
  metadata: Record<string, unknown>,
): string | undefined {
  const candidates = [metadata.voiceId, metadata.voice_id, metadata.providerVoiceId];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return undefined;
}

function extractRawStyleFromMetadata(metadata: Record<string, unknown>): string {
  const candidates = [
    metadata.voiceStyle,
    metadata.voice_style,
    metadata.voiceProfile,
    metadata.voice_profile,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/**
 * Extract voice profile from audio metadata or audio configuration.
 */
export function extractVoiceProfileFromMetadata(
  metadata?: Record<string, unknown>,
): {
  voiceProfile: VoiceProfile;
  voiceId?: string;
} {
  if (!metadata) {
    return { voiceProfile: 'calm_authoritative' };
  }

  const voiceId = extractVoiceIdFromMetadata(metadata);
  const rawStyle = extractRawStyleFromMetadata(metadata);
  const voiceProfile = resolveVoiceProfileStyle(rawStyle);

  return { voiceProfile, voiceId };
}
