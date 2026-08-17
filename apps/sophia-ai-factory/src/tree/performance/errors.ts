/**
 * Performance module error types.
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/performance/errors
 */

export type PerformanceErrorCode =
  | 'D1_UNAVAILABLE'
  | 'INSERT_FAILED'
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION';

export class PerformanceError extends Error {
  code: PerformanceErrorCode;

  constructor(code: PerformanceErrorCode, message: string) {
    super(message);
    this.name = 'PerformanceError';
    this.code = code;
  }
}