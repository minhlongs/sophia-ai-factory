/** Channel provider types — canonical source for cross-layer access */
import type { ProvenanceInput } from './provenance';

export type ChannelProvider = 'tiktok' | 'youtube' | 'instagram' | 'pinterest' | 'linkedin' | 'zalo' | 'facebook' | 'twitter' | 'threads' | 'reddit' | 'bluesky' | 'mastodon' | 'telegram' | 'whatsapp';

/** Platform subset for publishing integrations (Youtube, TikTok, Instagram) */
export type Platform = 'youtube' | 'tiktok' | 'instagram';

export type PublishStatus = 'scheduled' | 'uploading' | 'processing' | 'live' | 'failed'; /** Channel status — 'expired' consistently (not 'suspended') */ export type ChannelStatus = 'active' | 'disconnected' | 'expired'; export type VideoPrivacyStatus = 'public' | 'unlisted' | 'private'; export interface PublishMeta {
  caption: string;
  hashtags: string[];
  title?: string;
  productLink?: string;
  privacyStatus?: VideoPrivacyStatus;
  /**
   * Whether this video is synthetic (AI-generated). YouTube requires the
   * `containsSyntheticMedia` disclosure for altered content; platforms without
   * that field ignore it.
   */
  containsSyntheticMedia?: boolean;
  /** TikTok Content Posting API v2 privacy level chosen by the reviewer. */
  tiktokPrivacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  /** TikTok commercial content disclosure — creator's own brand. */
  brandOrganicToggle?: boolean;
  /** TikTok commercial content disclosure — third-party paid partnership. */
  brandContentToggle?: boolean;
  /** Optional claim/source provenance payload evaluated before YouTube publish. */
  provenance?: ProvenanceInput;
} export interface MetricsJson { views: number; likes: number; comments?: number; shares?: number; reach?: number; [key: string]: number | string | undefined; } export interface Publisher { upload(videoUrl: string, meta: PublishMeta): Promise<string>; pollStatus(externalPostId: string): Promise<PublishStatus>; getMetrics(externalPostId: string): Promise<MetricsJson>; }
