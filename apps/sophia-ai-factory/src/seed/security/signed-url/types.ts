/**
 * Signed URL Types & Constants
 *
 * Layer: seed/security
 *
 * @module seed/security/signed-url/types
 */

import type {
  SignedDownloadTokenPayload,
  CreateSignedDownloadTokenParams,
  VerifySignedDownloadTokenParams,
  VerifySignedDownloadTokenResult,
} from '@/seed/types/streaming';

export const DEFAULT_SIGNED_URL_TTL_SECONDS = 86400; // 24 hours

export type {
  SignedDownloadTokenPayload,
  CreateSignedDownloadTokenParams,
  VerifySignedDownloadTokenParams,
  VerifySignedDownloadTokenResult,
};
