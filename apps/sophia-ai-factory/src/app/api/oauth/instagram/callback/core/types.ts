export const SERVICE_NAME = 'instagram-oauth';
export const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export interface StateData {
  userId: string;
}

export interface ShortLivedTokenResponse {
  access_token?: string;
  error?: { message: string };
}

export interface LongLivedTokenResponse {
  access_token?: string;
  expires_in?: number;
}

export interface InstagramMeResponse {
  id?: string;
  name?: string;
}
