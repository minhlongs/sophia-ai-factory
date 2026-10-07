/**
 * Social Syndication Pacer
 *
 * Manages staggered publishing schedules to prevent anti-spam triggers
 * across social platforms (TikTok, X, YouTube Shorts).
 *
 * Layer: tree/social/syndication (Domain Logic)
 * @module tree/social/syndication/syndication-pacer
 */

export interface SyndicationEvent {
  id: string;
  niche: 'saas_global' | 'crypto_global';
  platform: 'tiktok' | 'x' | 'youtube';
  scheduledAt: Date;
}

export function calculatePublishingDelay(
  platform: SyndicationEvent['platform'],
  existingCount: number,
): number {
  // Staggered pacing: base delay + jitter to avoid robotic behavior
  const baseDelayMs = 15 * 60 * 1000; // 15 minutes base
  const multiplier = Math.max(1, Math.min(existingCount * 2, 8)); // At least 1x, max 8x delay
  const jitter = Math.floor(Math.random() * 5 * 60 * 1000); // 0-5 min jitter

  return baseDelayMs * multiplier + jitter;
}
