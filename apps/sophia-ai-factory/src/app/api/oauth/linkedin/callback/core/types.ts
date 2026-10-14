export const SERVICE_NAME = 'linkedin-oauth';
export const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export interface LinkedInTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

export interface LinkedInProfileResponse {
  id?: string;
  localizedFirstName?: string;
  localizedLastName?: string;
}
