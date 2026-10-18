/**
 * Instagram Graph API constants and helpers
 * @module land/video/publishing/providers/instagram-helpers
 */

import type { PublishMeta } from './publisher-interface';

export const GRAPH_API_VERSION = 'v19.0';
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export const POLL_ATTEMPTS = 10;
export const POLL_INTERVAL_MS = 2000;

export function isMockMode(): boolean {
  return !process.env.INSTAGRAM_APP_ID;
}

export interface IGMediaResponse {
  id: string;
  status_code?: string;
}

export interface IGInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value: number }> }>;
}

export function buildCaption(meta: PublishMeta): string {
  const hashtags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  return `${adCaption}\n\n${hashtags}${meta.productLink ? `\n\n${meta.productLink}` : ''}`;
}