import type { Gender } from '../presets';
import type { RegionalDialect } from '@/seed/types/cultural-adaptation';
import type { LocalizedVoiceProfile, VoiceProfileFilter } from './types';
import { INTERNATIONAL_VOICE_PROFILES } from './international-profiles';
import { VIETNAMESE_VOICE_PROFILES } from './vietnamese-profiles';

/**
 * Canonical registry of localized dialect voice profiles.
 */
export const LOCALIZED_VOICE_PROFILES: readonly LocalizedVoiceProfile[] = [
  ...INTERNATIONAL_VOICE_PROFILES,
  ...VIETNAMESE_VOICE_PROFILES,
] as const;

/**
 * Retrieve a localized voice profile by stable preset ID.
 */
export function getLocalizedVoiceProfile(presetId: string): LocalizedVoiceProfile | undefined {
  return LOCALIZED_VOICE_PROFILES.find((p) => p.presetId === presetId || p.id === presetId);
}

/**
 * List localized voice profiles matching an optional filter.
 */
export function listLocalizedVoiceProfiles(
  filter?: VoiceProfileFilter,
): readonly LocalizedVoiceProfile[] {
  return LOCALIZED_VOICE_PROFILES.filter((profile) => {
    if (filter?.dialect && profile.dialect !== filter.dialect) return false;
    if (filter?.baseLanguage && profile.baseLanguage !== filter.baseLanguage) return false;
    if (filter?.gender && profile.gender !== filter.gender) return false;
    if (filter?.minTier && profile.minTier !== filter.minTier) return false;
    return true;
  });
}

/**
 * Resolve the best matching localized voice profile for a dialect and gender.
 */
export function resolveDialectVoice(
  dialect: RegionalDialect,
  gender: Gender = 'female',
): LocalizedVoiceProfile {
  const match = LOCALIZED_VOICE_PROFILES.find(
    (p) => p.dialect === dialect && p.gender === gender && p.status === 'active',
  );
  if (match) return match;

  const dialectFallback = LOCALIZED_VOICE_PROFILES.find(
    (p) => p.dialect === dialect && p.status === 'active',
  );
  if (dialectFallback) return dialectFallback;

  // Ultimate fallback to default profile
  return LOCALIZED_VOICE_PROFILES[0];
}
