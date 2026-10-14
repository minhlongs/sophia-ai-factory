export const SERVICE_NAME = 'zalo-oauth';
export const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export interface ZaloTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: number;
  message?: string;
}

export interface ZaloOAInfoResponse {
  error: number;
  message: string;
  data?: { oa_id?: string; name?: string };
}
