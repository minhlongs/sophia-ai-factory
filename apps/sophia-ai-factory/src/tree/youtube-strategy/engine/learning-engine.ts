/**
 * Measurement Windows & Schedule Orchestration
 *
 * Layer: tree/youtube-strategy/engine
 */

import type { PerformanceSnapshot } from './types';

/**
 * Determine which measurement windows are due for a video.
 */
export function getDueMeasurementWindows(
  video: { published_at?: string; youtube_id?: string; youtubeId?: string },
  existingSnapshots: readonly PerformanceSnapshot[],
): string[] {
  const published = new Date(video.published_at ?? video.youtubeId ?? video.youtube_id ?? '');
  if (Number.isNaN(published.getTime())) return [];
  const ageHours = (Date.now() - published.getTime()) / 3600000;
  const existing = new Set(
    existingSnapshots
      .filter((s) => s.videoId === (video.youtube_id ?? video.youtubeId))
      .map((s) => s.measurementWindow),
  );
  const windows: string[] = [];
  if (ageHours >= 24 && !existing.has('24h')) windows.push('24h');
  if (ageHours >= 168 && !existing.has('7d')) windows.push('7d');
  return windows;
}

/**
 * Calculate measurement period for a given window.
 */
export function measurementPeriod(
  publishedAt: string | null,
  measurementWindow: string,
): { startDate: string; endDate: string } | null {
  if (!['24h', '7d'].includes(measurementWindow) || !publishedAt) return null;
  const start = new Date(publishedAt);
  if (Number.isNaN(start.getTime())) return null;
  const days = measurementWindow === '24h' ? 1 : 7;
  const end = new Date(
    Math.min(Date.now(), start.getTime() + days * 86400000),
  );
  return { startDate: date(start), endDate: date(end) };
}

function date(value: Date): string {
  return value.toISOString().slice(0, 10);
}
