/**
 * Bluesky Publisher Types and Constants
 * Layer: FOREST (Infrastructure Orchestration)
 */

export const SERVICE_NAME = 'bluesky-publisher';
export const DEFAULT_PDS = 'https://bsky.social';
export const MAX_POST_LENGTH = 300;

export function isMockMode(): boolean {
  return !process.env.BLUESKY_PDS_URL;
}

export interface AtprotoCreateRecordResponse {
  uri?: string;
  cid?: string;
  error?: string;
  message?: string;
}
