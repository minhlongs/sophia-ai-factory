/**
 * Distribution OS error types.
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/distribution/errors
 */

export type DistributionErrorCode =
  | 'D1_UNAVAILABLE'
  | 'INSERT_FAILED'
  | 'NOT_FOUND'
  | 'INVALID_STATUS'
  | 'INVALID_TRANSITION';

export class DistributionError extends Error {
  code: DistributionErrorCode;

  constructor(code: DistributionErrorCode, message: string) {
    super(message);
    this.name = 'DistributionError';
    this.code = code;
  }
}
