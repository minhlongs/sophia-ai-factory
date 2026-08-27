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
