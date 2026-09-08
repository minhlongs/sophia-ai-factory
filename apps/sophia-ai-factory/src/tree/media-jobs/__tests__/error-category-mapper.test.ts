/**
 * Unit tests for error-category-mapper.
 *
 * @module tree/media-jobs/__tests__/error-category-mapper
 */

import { describe, it, expect } from 'vitest';
import { mapFailureKindToErrorCategory } from '../error-category-mapper';
import { FailureKind } from '@/seed/types/failure-kind';
import { ErrorCategory } from '@/seed/types/creative-job-economics';

describe('mapFailureKindToErrorCategory', () => {
  it('maps AUTH_FAILURE -> AUTH', () => {
    expect(mapFailureKindToErrorCategory(FailureKind.AUTH_FAILURE)).toBe(ErrorCategory.AUTH);
  });

  it('maps RATE_LIMIT -> RATE_LIMIT', () => {
    expect(mapFailureKindToErrorCategory(FailureKind.RATE_LIMIT)).toBe(ErrorCategory.RATE_LIMIT);
  });

  it('maps TIMEOUT -> TIMEOUT', () => {
    expect(mapFailureKindToErrorCategory(FailureKind.TIMEOUT)).toBe(ErrorCategory.TIMEOUT);
  });

  it('maps SERVER_ERROR -> PROVIDER', () => {
    expect(mapFailureKindToErrorCategory(FailureKind.SERVER_ERROR)).toBe(ErrorCategory.PROVIDER);
  });

  it('maps NETWORK -> NETWORK', () => {
    expect(mapFailureKindToErrorCategory(FailureKind.NETWORK)).toBe(ErrorCategory.NETWORK);
  });

  it('maps PROVIDER_NOT_CERTIFIED -> PROVIDER', () => {
    expect(mapFailureKindToErrorCategory(FailureKind.PROVIDER_NOT_CERTIFIED)).toBe(
      ErrorCategory.PROVIDER,
    );
  });

  it('maps UNKNOWN -> UNKNOWN', () => {
    expect(mapFailureKindToErrorCategory(FailureKind.UNKNOWN)).toBe(ErrorCategory.UNKNOWN);
  });
});
