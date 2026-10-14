/**
 * Types, constants, and error definitions for Zalo Official Account publisher.
 * @module land/video/publishing/providers/zalo/types
 */

export const ZALO_OA_API = 'https://openapi.zalo.me';
export const MAX_CAPTION_LEN = 1000;

/** Thrown when Zalo OA credentials are absent — guides VN business owner to verify OA. */
export class ZaloVerificationRequiredError extends Error {
  readonly actionUrl = 'https://oa.zalo.me/manage/oa';
  readonly docsUrl = 'https://developers.zalo.me/docs/official-account';

  constructor() {
    super(
      'Zalo OA credentials not configured. ' +
        'Your business must be verified on Zalo Official Account before using this publisher. ' +
        'Please complete business verification at https://oa.zalo.me/manage/oa ' +
        'and then set ZALO_APP_ID, ZALO_APP_SECRET, and ZALO_OA_ACCESS_TOKEN environment variables. ' +
        'Documentation: https://developers.zalo.me/docs/official-account',
    );
    this.name = 'ZaloVerificationRequiredError';
  }
}

/**
 * Mock mode: ZALO_APP_ID is set (developer configured) but ZALO_OA_ACCESS_TOKEN absent.
 * Gate: neither env is present → throw ZaloVerificationRequiredError.
 */
export function checkMode(): 'missing' | 'mock' | 'real' {
  if (!process.env.ZALO_APP_ID && !process.env.ZALO_OA_ACCESS_TOKEN) return 'missing';
  if (!process.env.ZALO_OA_ACCESS_TOKEN) return 'mock';
  return 'real';
}

export interface ZaloUploadResponse {
  error: number;
  message: string;
  data?: { video_id?: string; token?: string };
}

export interface ZaloBroadcastResponse {
  error: number;
  message: string;
  data?: { broadcast_id?: string };
}
