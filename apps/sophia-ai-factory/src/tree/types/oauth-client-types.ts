/**
 * OAuth client interface types for platform adapters.
 *
 * These interfaces define the contract for platform-specific OAuth operations
 * that are implemented in the land layer. The adapters in tree/ use these
 * interfaces via dependency injection or the global registry to avoid layer-boundary imports.
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

let defaultYouTubeOAuthClient: YouTubeOAuthClient | null = null;
let defaultTikTokOAuthClient: TikTokOAuthClient | null = null;

export function registerYouTubeOAuthClient(client: YouTubeOAuthClient | null): void {
  defaultYouTubeOAuthClient = client;
}

export function getYouTubeOAuthClient(): YouTubeOAuthClient | null {
  return defaultYouTubeOAuthClient;
}

export function registerTikTokOAuthClient(client: TikTokOAuthClient | null): void {
  defaultTikTokOAuthClient = client;
}

export function getTikTokOAuthClient(): TikTokOAuthClient | null {
  return defaultTikTokOAuthClient;
}
