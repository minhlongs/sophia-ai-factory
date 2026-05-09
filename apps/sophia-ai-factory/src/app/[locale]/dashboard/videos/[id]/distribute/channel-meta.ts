/**
 * Static metadata for social channel providers used in the distribute UI.
 * Shared between distribute-panel and publishing-status-badges.
 *
 * @module app/[locale]/dashboard/videos/[id]/distribute/channel-meta
 */

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
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  uploading: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  processing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  live: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};
