/** Channel provider types — canonical source for cross-layer access */
export type ChannelProvider = 'tiktok' | 'youtube' | 'instagram' | 'pinterest' | 'linkedin' | 'zalo' | 'facebook' | 'twitter' | 'threads' | 'reddit' | 'bluesky' | 'mastodon' | 'telegram';

/** Platform subset for publishing integrations (Youtube, TikTok, Instagram) */
export type Platform = 'youtube' | 'tiktok' | 'instagram';

export type PublishStatus = 'scheduled' | 'uploading' | 'processing' | 'live' | 'failed'; /** Channel status — 'expired' consistently (not 'suspended') */ export type ChannelStatus = 'active' | 'disconnected' | 'expired'; export interface PublishMeta { caption: string; hashtags: string[]; title?: string; productLink?: string; } export interface MetricsJson { views: number; likes: number; comments?: number; shares?: number; reach?: number; [key: string]: number | string | undefined; } export interface Publisher { upload(videoUrl: string, meta: PublishMeta): Promise<string>; pollStatus(externalPostId: string): Promise<PublishStatus>; getMetrics(externalPostId: string): Promise<MetricsJson>; }
