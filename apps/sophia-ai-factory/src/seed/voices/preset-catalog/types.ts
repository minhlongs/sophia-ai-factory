export type Gender = 'male' | 'female' | 'neutral';

/** ISO 639-1 codes Coqui XTTS-v2 and Edge TTS support. */
export type VoiceLanguage = 'en' | 'vi' | 'es' | 'fr' | 'de' | 'pt' | 'ja' | 'zh' | 'ko' | 'th';

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
