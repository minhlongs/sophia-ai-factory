import type { ProvenanceInput } from '@/tree/youtube-strategy/provenance-reviewer';

export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'x' | 'whatsapp' | 'blog';

export interface PublishParams {
  videoUrl: string;
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacy?: 'public' | 'unlisted' | 'private';
  scheduledAt?: string;
  thumbnailUrl?: string;
  /**
   * Whether this video is synthetic (AI-generated). YouTube requires the
   * `containsSyntheticMedia` disclosure for altered content; other platforms
   * have no equivalent field, so it is consumed by the adapter that accepts it
   * and ignored elsewhere.
   */
  containsSyntheticMedia?: boolean;
  /** Provenance review input; drives the YouTube synthetic-media disclosure. */
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
