export const SERVICE_NAME = 'pinterest-oauth';
export const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export interface PinterestTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface PinterestUserResponse {
  id?: string;
  username?: string;
  profile_image?: string;
}

export interface PinterestBoardResponse {
  items?: Array<{ id: string; name: string }>;
}
