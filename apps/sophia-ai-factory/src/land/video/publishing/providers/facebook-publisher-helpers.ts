/**
 * Facebook Publisher Graph API Helpers — description formatting & insight parsing.
 * @module land/video/publishing/providers/facebook-publisher-helpers
 */

import type { PublishMeta, MetricsJson } from './publisher-interface';

const GRAPH_API_VERSION = 'v21.0';
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export function isMockMode(): boolean {
  return !process.env.FACEBOOK_APP_ID;
}

export interface FBVideoResponse {
  id?: string;
  status?: { video_status?: string };
  error?: { message?: string };
}

export interface FBInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value: number | Record<string, number> }> }>;
}

export function buildFacebookReelDescription(meta: PublishMeta): string {
  const hashtags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  return `${adCaption}\n\n${hashtags}${meta.productLink ? `\n\n${meta.productLink}` : ''}`.slice(0, 2200);
}

export function parseFacebookInsights(data: FBInsightsResponse): MetricsJson {
  const findNum = (name: string): number => {
    const v = data.data?.find((m) => m.name === name)?.values?.[0]?.value;
    return typeof v === 'number' ? v : 0;
  };
  const findReactionTotal = (name: string): number => {
    const v = data.data?.find((m) => m.name === name)?.values?.[0]?.value;
    if (typeof v !== 'object' || v === null) return 0;
    return Object.values(v).reduce((sum: number, n) => sum + (typeof n === 'number' ? n : 0), 0);
  };

  return {
    views: findNum('total_video_views') || findNum('total_video_impressions'),
    reach: findNum('total_video_impressions'),
    likes: findReactionTotal('post_video_likes_by_reaction_type'),
    comments: 0,
  };
}
