/**
 * Round 36 — Audio Loudness Normalizer & True-Peak Clipping Guard (-14 LUFS).
 *
 * Pure-TS loudness gain & ducking calculator for TikTok, YouTube Shorts, and
 * Instagram Reels so voiceover + BGM never clips (> -1.0 dBTP) or gets
 * loudness-penalized by platform ingest pipelines. $0 GPU / $0 server COGS.
 *
 * @module seed/video/audio-loudness-normalizer
 */

export type AudioPlatformTarget = 'tiktok' | 'youtube_shorts' | 'instagram_reels';

export interface AudioLoudnessInput {
  readonly platform: AudioPlatformTarget;
  readonly measuredLufs: number;
  readonly truePeakDbtp: number;
  readonly bgmOffsetDb: number;
}

export interface AudioLoudnessPlan {
  readonly targetLufs: number;
  readonly maxTruePeakDbtp: number;
  readonly recommendedGainDb: number;
  readonly limiterRequired: boolean;
  readonly bgmDuckingDb: number;
  readonly status: 'optimal' | 'needs_normalization' | 'clipping_risk';
  readonly reason: string;
}

const PLATFORM_LUFS_TARGETS: Record<AudioPlatformTarget, { target: number; maxPeak: number }> = {
  tiktok: { target: -14, maxPeak: -1.0 },
  youtube_shorts: { target: -14, maxPeak: -1.0 },
  instagram_reels: { target: -14, maxPeak: -1.5 },
};

export function planAudioLoudnessNormalization(input: AudioLoudnessInput): AudioLoudnessPlan {
  const spec = PLATFORM_LUFS_TARGETS[input.platform];

  if (
    !Number.isFinite(input.measuredLufs) ||
    !Number.isFinite(input.truePeakDbtp) ||
    !Number.isFinite(input.bgmOffsetDb)
  ) {
    return {
      targetLufs: spec.target,
      maxTruePeakDbtp: spec.maxPeak,
      recommendedGainDb: 0,
      limiterRequired: true,
      bgmDuckingDb: -18,
      status: 'clipping_risk',
      reason: 'Invalid non-finite loudness metrics (fail-closed limiter enabled).',
    };
  }

  const rawGain = Number((spec.target - input.measuredLufs).toFixed(2));
  const clampedGain = Math.max(-12, Math.min(12, rawGain));
  const projectedPeak = Number((input.truePeakDbtp + clampedGain).toFixed(2));
  const limiterRequired = projectedPeak > spec.maxPeak;
  const bgmDuckingDb = input.bgmOffsetDb > -14 ? -18 : Number(input.bgmOffsetDb.toFixed(1));

  if (limiterRequired) {
    return {
      targetLufs: spec.target,
      maxTruePeakDbtp: spec.maxPeak,
      recommendedGainDb: clampedGain,
      limiterRequired: true,
      bgmDuckingDb,
      status: 'clipping_risk',
      reason: `Projected peak ${projectedPeak} dBTP exceeds ${spec.maxPeak} dBTP ceiling; apply true-peak limiter.`,
    };
  }

  if (Math.abs(rawGain) > 1.0) {
    return {
      targetLufs: spec.target,
      maxTruePeakDbtp: spec.maxPeak,
      recommendedGainDb: clampedGain,
      limiterRequired: false,
      bgmDuckingDb,
      status: 'needs_normalization',
      reason: `Apply ${clampedGain > 0 ? '+' : ''}${clampedGain} dB gain to hit ${spec.target} LUFS.`,
    };
  }

  return {
    targetLufs: spec.target,
    maxTruePeakDbtp: spec.maxPeak,
    recommendedGainDb: 0,
    limiterRequired: false,
    bgmDuckingDb,
    status: 'optimal',
    reason: `Audio sits within ±1 LUFS of ${spec.target} LUFS with safe true-peak headroom.`,
  };
}
