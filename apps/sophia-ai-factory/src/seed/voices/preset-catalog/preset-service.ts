import type { VoicePreset, VoiceLanguage, Tier } from './types';
import { ENGLISH_PRESETS, VIETNAMESE_PRESETS } from './vietnamese-presets';
import { MULTILINGUAL_PRESETS } from './multilingual-presets';

export const VOICE_PRESETS: readonly VoicePreset[] = [
  ...ENGLISH_PRESETS,
  ...VIETNAMESE_PRESETS,
  ...MULTILINGUAL_PRESETS,
] as const;

const TIER_ORDER: Record<Tier, number> = {
  BASIC: 0,
  PREMIUM: 1,
  ENTERPRISE: 2,
  MASTER: 3,
};

export function getVoicePreset(id: string): VoicePreset | undefined {
  return VOICE_PRESETS.find((preset) => preset.id === id);
}

export function listPresetsByLanguage(locale: string): VoicePreset[] {
  const lang = locale.slice(0, 2).toLowerCase() as VoiceLanguage;
  return VOICE_PRESETS.filter((preset) => preset.language === lang);
}

export function canAccessPreset(tier: Tier, preset: VoicePreset): boolean {
  return TIER_ORDER[tier] >= TIER_ORDER[preset.minTier];
}

export function listPresetsForTier(tier: Tier): VoicePreset[] {
  return VOICE_PRESETS.filter((preset) => canAccessPreset(tier, preset));
}
