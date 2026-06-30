/**
 * OAuth client interface types for platform adapters.
 *
 * These interfaces define the contract for platform-specific OAuth operations
 * that are implemented in the land layer. The adapters in tree/ use these
 * interfaces via dependency injection to avoid static layer-boundary imports.
 */

export interface YouTubeOAuthClient {
  uploadVideo(params: {
    accessToken: string;
    videoUrl: string;
    title: string;
    description: string;
    tags?: string[];
  }): Promise<string>;

  refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
  }>;
}

export interface TikTokOAuthClient {
  publishVideo(params: {
    accessToken: string;
    videoUrl: string;
    title: string;
  }): Promise<string>;

  checkPublishStatus(accessToken: string, publishId: string): Promise<{
    status: string;
    publicUrl?: string;
  }>;
}
