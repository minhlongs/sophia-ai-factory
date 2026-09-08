/**
 * @module tree/media-jobs/error-category-mapper
 *
 * Maps FailureKind (circuit-breaker taxonomy) to ErrorCategory
 * (creative-job-economics taxonomy) for SUPREME COMMAND #9 — Phase 9.
 *
 * Pure function — no I/O. Used when classifying failed media jobs
 * into the economic error taxonomy.
 *
 * Layer rule: tree — imports from seed only.
 */

import { ErrorCategory } from '@/seed/types/creative-job-economics';
import { FailureKind } from '@/seed/types/failure-kind';

/**
 * Map a FailureKind to its corresponding ErrorCategory.
 *
 * Mapping:
 * - AUTH_FAILURE         -> AUTH
 * - RATE_LIMIT           -> RATE_LIMIT
 * - TIMEOUT              -> TIMEOUT
 * - SERVER_ERROR         -> PROVIDER
 * - NETWORK              -> NETWORK
 * - PROVIDER_NOT_CERTIFIED -> PROVIDER
 * - UNKNOWN              -> UNKNOWN
 */
export function mapFailureKindToErrorCategory(kind: FailureKind): ErrorCategory {
  switch (kind) {
    case FailureKind.AUTH_FAILURE:
      return ErrorCategory.AUTH;
    case FailureKind.RATE_LIMIT:
      return ErrorCategory.RATE_LIMIT;
    case FailureKind.TIMEOUT:
      return ErrorCategory.TIMEOUT;
    case FailureKind.SERVER_ERROR:
      return ErrorCategory.PROVIDER;
    case FailureKind.NETWORK:
      return ErrorCategory.NETWORK;
    case FailureKind.PROVIDER_NOT_CERTIFIED:
      return ErrorCategory.PROVIDER;
    case FailureKind.UNKNOWN:
    default:
      return ErrorCategory.UNKNOWN;
  }
}
