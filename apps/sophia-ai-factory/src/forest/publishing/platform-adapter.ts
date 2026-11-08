import type { ProvenanceInput } from '@/tree/youtube-strategy/provenance-reviewer';

export type Platform = 'youtube' | 'tiktok' | 'instagram';

export interface PublishParams {
  videoUrl: string;
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacy?: 'public' | 'unlisted' | 'private';
  scheduledAt?: string;
  thumbnailUrl?: string;
  /** Channel identifier, used for logging a capability-driven downgrade. */
  channelId?: string;
  /** Duration in seconds, compared against the creator's reported maximum. */
  durationSeconds?: number;
  /**
   * Whether this video is synthetic (AI-generated). YouTube requires the
   * `containsSyntheticMedia` disclosure for altered content; TikTok and
   * Instagram have no equivalent field, so this is consumed by the adapter
   * that accepts it and ignored elsewhere.
   */
  containsSyntheticMedia?: boolean;
  /** Provenance review input; drives the synthetic-media disclosure. */
  provenance?: ProvenanceInput;
}

export interface PublishResult {
  platformVideoId: string;
  status: PublishStatus;
  url?: string;
}

export type PublishStatus = 'pending' | 'uploading' | 'processing' | 'published' | 'failed';

export interface PlatformAdapter {
  platform: Platform;
  uploadVideo(
    accessToken: string,
    params: PublishParams,
  ): Promise<PublishResult>;
  checkStatus(
    accessToken: string,
    platformVideoId: string,
  ): Promise<{ status: PublishStatus; error?: string }>;
  refreshToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }>;
}
