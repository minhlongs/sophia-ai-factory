/**
 * Channel meta constants for distribute components
 * @module app/(app)/dashboard/videos/[id]/distribute/channel-meta
 */

import type { ChannelProvider } from '@/seed/types/channel-provider';

export const PROVIDER_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
  pinterest: 'Pinterest',
  linkedin: 'LinkedIn',
  zalo: 'Zalo',
  facebook: 'Facebook',
  twitter: 'X (Twitter)',
  threads: 'Threads',
  reddit: 'Reddit',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  telegram: 'Telegram',
};

export const PUBLISH_STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  uploading: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  live: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};