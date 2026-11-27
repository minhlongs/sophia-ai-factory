/**
 * Round 38 — Multi-Timezone Audience Peak Publish Window Scheduler.
 *
 * Computes the next highest-retention publish slot across Vietnam (UTC+7),
 * US East (UTC-5), Europe (UTC+1), and UK (UTC+0) per short-form platform,
 * avoiding dead overnight hours and low-CTR midday troughs.
 *
 * @module seed/growth/optimal-publish-window
 */

export type AudienceRegion = 'VN' | 'US' | 'EU' | 'UK';
export type PublishPlatform = 'tiktok' | 'youtube_shorts' | 'instagram_reels';

export interface OptimalWindowInput {
  readonly region: AudienceRegion;
  readonly platform: PublishPlatform;
  readonly currentUtcHour: number;
}

export interface OptimalWindowRecommendation {
  readonly region: AudienceRegion;
  readonly timezoneLabel: string;
  readonly localPeakHour: number;
  readonly utcPublishHour: number;
  readonly hoursUntilSlot: number;
  readonly windowLabel: string;
}

const REGION_UTC_OFFSET: Record<AudienceRegion, { offset: number; label: string }> = {
  VN: { offset: 7, label: 'UTC+7 (Asia/Saigon)' },
  US: { offset: -5, label: 'UTC-5 (America/New_York)' },
  EU: { offset: 1, label: 'UTC+1 (Europe/Berlin)' },
  UK: { offset: 0, label: 'UTC+0 (Europe/London)' },
};

const PLATFORM_LOCAL_PEAK_HOURS: Record<PublishPlatform, readonly number[]> = {
  tiktok: [11, 19, 21],
  youtube_shorts: [12, 18, 20],
  instagram_reels: [11, 17, 20],
};

export function computeOptimalPublishWindow(input: OptimalWindowInput): OptimalWindowRecommendation {
  const { offset, label } = REGION_UTC_OFFSET[input.region];
  const safeUtcHour = Number.isFinite(input.currentUtcHour)
    ? ((Math.floor(input.currentUtcHour) % 24) + 24) % 24
    : 0;
  const currentLocalHour = ((safeUtcHour + offset) % 24 + 24) % 24;
  const peaks = PLATFORM_LOCAL_PEAK_HOURS[input.platform];

  const nextLocalPeak = peaks.find((h) => h > currentLocalHour) ?? peaks[0];
  const hoursUntilSlot =
    nextLocalPeak > currentLocalHour
      ? nextLocalPeak - currentLocalHour
      : 24 - currentLocalHour + nextLocalPeak;
  const utcPublishHour = ((nextLocalPeak - offset) % 24 + 24) % 24;

  const hh = String(nextLocalPeak).padStart(2, '0');
  const utcHh = String(utcPublishHour).padStart(2, '0');

  return {
    region: input.region,
    timezoneLabel: label,
    localPeakHour: nextLocalPeak,
    utcPublishHour,
    hoursUntilSlot,
    windowLabel: `${hh}:00 local (${utcHh}:00 UTC)`,
  };
}
