export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const YOUTUBE_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';
export const YOUTUBE_CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';

export const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
];

export interface YouTubeTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface YouTubeRefreshResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface YouTubeChannelInfo {
  channelId: string;
  title: string;
  thumbnailUrl: string;
}

export interface UploadVideoParams {
  accessToken: string;
  videoUrl: string;
  title: string;
  description: string;
  tags: string[];
}
