/**
 * Audio Mixer Builder.
 * Synthesizes dynamic volume ducking curves and mixes voiceover, BGM and SFX.
 */

import type { AudioMixSpec, SFXCue, VolumeKeyframe } from './audio-types';
import { getBgmForNiche } from './bgm-library';

export interface AudioMixerRequest {
  niche: 'saas_global' | 'crypto_global';
  totalDurationSeconds: number;
  sfxCues: SFXCue[];
  preferredBgmId?: string;
  hasVoiceover?: boolean;
}

export function buildAudioMixSpec(request: AudioMixerRequest): AudioMixSpec {
  const {
    niche,
    totalDurationSeconds,
    sfxCues,
    hasVoiceover = true,
  } = request;

  const bgmTrack = getBgmForNiche(niche);

  // Calculate volume ducking curve:
  // t=0s: -8dB (Loud Hook)
  // t=0.8s: -18dB (Voiceover narration ducking)
  // t=duration-2.5s: -8dB (Outro CTA swell)
  // t=duration: -24dB (Fade out)
  const duckingKeyframes: VolumeKeyframe[] = [];

  if (hasVoiceover && totalDurationSeconds > 4.0) {
    duckingKeyframes.push({ timeSeconds: 0.0, volumeDb: -8.0 });
    duckingKeyframes.push({ timeSeconds: 0.8, volumeDb: -18.0 });
    duckingKeyframes.push({
      timeSeconds: Number((totalDurationSeconds - 2.5).toFixed(2)),
      volumeDb: -18.0,
    });
    duckingKeyframes.push({
      timeSeconds: Number((totalDurationSeconds - 2.0).toFixed(2)),
      volumeDb: -8.0,
    });
    duckingKeyframes.push({
      timeSeconds: Number(totalDurationSeconds.toFixed(2)),
      volumeDb: -30.0,
    });
  } else {
    duckingKeyframes.push({ timeSeconds: 0.0, volumeDb: -10.0 });
    duckingKeyframes.push({
      timeSeconds: Number(totalDurationSeconds.toFixed(2)),
      volumeDb: -30.0,
    });
  }

  return {
    bgmTrackId: bgmTrack.id,
    bgmUrl: bgmTrack.url,
    bgmVolumeDb: -18.0,
    duckingKeyframes,
    sfxCues,
    voiceoverVolumeDb: 0.0, // 0dB master reference
    totalDurationSeconds,
  };
}
