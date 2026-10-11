import type { PublishedVideoRow, DateRange } from './types';

export function getDateRange(daysBack = 30): DateRange {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

export function groupVideosByUser(
  videos: PublishedVideoRow[],
): Map<string, PublishedVideoRow[]> {
  const byUser = new Map<string, PublishedVideoRow[]>();
  for (const row of videos) {
    const arr = byUser.get(row.user_id) ?? [];
    arr.push(row);
    byUser.set(row.user_id, arr);
  }
  return byUser;
}

export function createPlatformToVideoMap(
  videos: PublishedVideoRow[],
): Map<string, string> {
  return new Map(videos.map((v) => [v.platform_video_id, v.video_id]));
}
