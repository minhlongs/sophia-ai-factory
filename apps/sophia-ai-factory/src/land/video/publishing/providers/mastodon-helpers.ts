/**
 * Mastodon Publisher helpers, types, and text formatting utilities.
 * @module land/video/publishing/providers/mastodon-helpers
 */

import type { PublishMeta, MetricsJson } from './publisher-interface';

const MAX_STATUS_LENGTH = 500;

export function isMockMode(): boolean {
  return !process.env.MASTODON_INSTANCE_URL;
}

export interface MastodonStatusResponse {
  id?: string;
  uri?: string;
  error?: string;
}

export interface MastodonStatusStats {
  id?: string;
  replies_count?: number;
  reblogs_count?: number;
  favourites_count?: number;
}

export const ZERO_MASTODON_METRICS: MetricsJson = {
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
};

export function buildStatusText(meta: PublishMeta, videoUrl: string): string {
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  const tags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const link = meta.productLink ?? videoUrl;
  const full = `${adCaption}${tags ? ` ${tags}` : ''}\n\n${link}`;
  return full.length > MAX_STATUS_LENGTH ? full.slice(0, MAX_STATUS_LENGTH - 1) + '…' : full;
}

/** Parse instanceUrl from compound external_account_id "<instanceUrl>|<accountId>" */
export function parseExternalAccountId(externalAccountId: string): {
  instanceUrl: string;
  accountId: string;
} {
  const separatorIdx = externalAccountId.lastIndexOf('|');
  if (separatorIdx === -1) {
    // Fallback: treat entire value as accountId with default instance
    return {
      instanceUrl: process.env.MASTODON_INSTANCE_URL ?? 'https://mastodon.social',
      accountId: externalAccountId,
    };
  }
  return {
    instanceUrl: externalAccountId.slice(0, separatorIdx),
    accountId: externalAccountId.slice(separatorIdx + 1),
  };
}
