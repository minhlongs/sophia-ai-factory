/**
 * Audio and Sound FX (SFX) types for SaaS & Crypto video creation.
 */

export type SFXType =
  | 'whoosh_fast'
  | 'whoosh_deep'
  | 'cha_ching'
  | 'notification_ding'
  | 'glitch_hit'
  | 'pop'
  | 'riser_hype'
  | 'bass_drop'
  | 'compliance_beep';

export type BGMEnergyLevel =
  | 'high_energy_hype'
  | 'dark_cyberpunk'
  | 'corporate_sleek'
  | 'chill_lofi'
  | 'cinematic_epic';

export interface BGMTrack {
  id: string;
  name: string;
  energyLevel: BGMEnergyLevel;
  url: string;
  durationSeconds: number;
  bpm: number;
  tags: string[];
  recommendedNiches: ('saas_global' | 'crypto_global' | 'general')[];
}

export interface SFXCue {
  id: string;
  type: SFXType;
  timestampSeconds: number;
  volume: number; // 0.0 to 1.0
  reason: string;
}

export interface VolumeKeyframe {
  timeSeconds: number;
  volumeDb: number; // e.g. -18dB during voiceover, -6dB during intro/outro
}

export interface AudioMixSpec {
  bgmTrackId: string;
  bgmUrl: string;
  bgmVolumeDb: number;
  duckingKeyframes: VolumeKeyframe[];
  sfxCues: SFXCue[];
  voiceoverVolumeDb: number;
  totalDurationSeconds: number;
}
