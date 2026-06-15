/**
 * Voice presets registry — Coqui XTTS speakers wired to the TTS API.
 *
 * Each entry maps a stable internal preset ID (`alex-en-m`, `linh-vi-f`, etc.)
 * to a Coqui XTTS speaker reference + display metadata. The TTS API
 * (`/api/internal/tts`) accepts `voiceId` directly, so callers should pass
 * `coquiSpeaker` from this registry — preserving the public preset ID for
 * analytics and tier-gating decisions.
 *
 * Adding a preset:
 *   1. License-check the speaker (Coqui XTTS-v2 default speakers are MIT/CC).
 *   2. Append a new entry below with a unique `id` (kebab-case).
 *   3. Drop a 5-second sample WAV at `public/voices/{id}.wav`.
 *
 * @module seed/voices/presets
 */

export type Gender = 'male' | 'female' | 'neutral';

/** ISO 639-1 codes Coqui XTTS-v2 supports. */
export type VoiceLanguage = 'en' | 'vi' | 'es' | 'fr' | 'de' | 'pt' | 'ja' | 'zh';

export type Tier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

export interface VoicePreset {
  /** Stable public ID — never rename; safe to log. */
  id: string;
  /** Human-readable label (English; localize at render time). */
  displayName: string;
  /** Coqui XTTS speaker reference passed to `/synth` as `voiceId`. */
  coquiSpeaker: string;
  language: VoiceLanguage;
  gender: Gender;
  /** Short descriptor: 'warm narrator', 'energetic explainer', etc. */
  vibe: string;
  /** Public sample (relative to PROD_URL). */
  samplePath: string;
  /** Lowest tier that may use this preset. Free tier gets BASIC presets. */
  minTier: Tier;
}

/** Registry — 12 presets across en + vi (XTTS-v2 default speakers, MIT-friendly). */
export const VOICE_PRESETS: readonly VoicePreset[] = [
  // ── English ───────────────────────────────────────────────────────────────
  {
    id: 'alex-en-m',
    displayName: 'Alex',
    coquiSpeaker: 'Damien Black',
    language: 'en',
    gender: 'male',
    vibe: 'warm narrator',
    samplePath: '/voices/alex-en-m.wav',
    minTier: 'BASIC',
  },
  {
    id: 'sophia-en-f',
    displayName: 'Sophia',
    coquiSpeaker: 'Claribel Dervla',
    language: 'en',
    gender: 'female',
    vibe: 'friendly tutor',
    samplePath: '/voices/sophia-en-f.wav',
    minTier: 'BASIC',
  },
  {
    id: 'mason-en-m',
    displayName: 'Mason',
    coquiSpeaker: 'Wulf Carlevaro',
    language: 'en',
    gender: 'male',
    vibe: 'energetic explainer',
    samplePath: '/voices/mason-en-m.wav',
    minTier: 'BASIC',
  },
  {
    id: 'ava-en-f',
    displayName: 'Ava',
    coquiSpeaker: 'Tammy Grit',
    language: 'en',
    gender: 'female',
    vibe: 'crisp news anchor',
    samplePath: '/voices/ava-en-f.wav',
    minTier: 'PREMIUM',
  },
  {
    id: 'rhys-en-m',
    displayName: 'Rhys',
    coquiSpeaker: 'Viktor Eka',
    language: 'en',
    gender: 'male',
    vibe: 'cinematic trailer',
    samplePath: '/voices/rhys-en-m.wav',
    minTier: 'PREMIUM',
  },
  {
    id: 'nora-en-f',
    displayName: 'Nora',
    coquiSpeaker: 'Brenda Stern',
    language: 'en',
    gender: 'female',
    vibe: 'calm meditation',
    samplePath: '/voices/nora-en-f.wav',
    minTier: 'ENTERPRISE',
  },
  // ── Vietnamese ────────────────────────────────────────────────────────────
  {
    id: 'linh-vi-f',
    displayName: 'Linh',
    coquiSpeaker: 'Daisy Studious',
    language: 'vi',
    gender: 'female',
    vibe: 'warm presenter',
    samplePath: '/voices/linh-vi-f.wav',
    minTier: 'BASIC',
  },
  {
    id: 'minh-vi-m',
    displayName: 'Minh',
    coquiSpeaker: 'Andrew Chipper',
    language: 'vi',
    gender: 'male',
    vibe: 'confident host',
    samplePath: '/voices/minh-vi-m.wav',
    minTier: 'BASIC',
  },
  {
    id: 'huong-vi-f',
    displayName: 'Hương',
    coquiSpeaker: 'Gracie Wise',
    language: 'vi',
    gender: 'female',
    vibe: 'youthful storyteller',
    samplePath: '/voices/huong-vi-f.wav',
    minTier: 'PREMIUM',
  },
  {
    id: 'bao-vi-m',
    displayName: 'Bảo',
    coquiSpeaker: 'Filip Traverse',
    language: 'vi',
    gender: 'male',
    vibe: 'documentary narrator',
    samplePath: '/voices/bao-vi-m.wav',
    minTier: 'ENTERPRISE',
  },
  // ── Spanish (bonus, en-route to multi-language) ───────────────────────────
  {
    id: 'mateo-es-m',
    displayName: 'Mateo',
    coquiSpeaker: 'Royston Min',
    language: 'es',
    gender: 'male',
    vibe: 'friendly host',
    samplePath: '/voices/mateo-es-m.wav',
    minTier: 'PREMIUM',
  },
  {
    id: 'lucia-es-f',
    displayName: 'Lucía',
    coquiSpeaker: 'Sofia Hellen',
    language: 'es',
    gender: 'female',
    vibe: 'lively explainer',
    samplePath: '/voices/lucia-es-f.wav',
    minTier: 'PREMIUM',
  },
] as const;

/** Tier ordering used for `canAccessPreset` gate. */
const TIER_ORDER: Record<Tier, number> = {
  BASIC: 0,
  PREMIUM: 1,
  ENTERPRISE: 2,
  MASTER: 3,
};

/**
 * Look up a preset by stable ID. Returns undefined if not found.
 * Prefer this over filtering the array inline so the lookup remains O(1)-friendly
 * for caller code (current array is small enough that O(n) scan is fine).
 */
export function getVoicePreset(id: string): VoicePreset | undefined {
  return VOICE_PRESETS.find((preset) => preset.id === id);
}

/** Filter presets by language (case-insensitive prefix match — accepts 'vi-VN'). */
export function listPresetsByLanguage(locale: string): VoicePreset[] {
  const lang = locale.slice(0, 2).toLowerCase() as VoiceLanguage;
  return VOICE_PRESETS.filter((preset) => preset.language === lang);
}

/** True if a tenant on `tier` may use `preset`. */
export function canAccessPreset(tier: Tier, preset: VoicePreset): boolean {
  return TIER_ORDER[tier] >= TIER_ORDER[preset.minTier];
}

/** All presets the given tier can access. */
export function listPresetsForTier(tier: Tier): VoicePreset[] {
  return VOICE_PRESETS.filter((preset) => canAccessPreset(tier, preset));
}
