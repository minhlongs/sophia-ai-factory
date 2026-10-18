/**
 * @module seed/types/creative-job-error-taxonomy
 *
 * Error taxonomy and classification helper for creative media jobs.
 * Layer rule: seed only.
 */

export type ErrorCategory =
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'PROVIDER'
  | 'VALIDATION'
  | 'NETWORK'
  | 'INTERNAL'
  | 'UNKNOWN';

export const ErrorCategory: Record<ErrorCategory, ErrorCategory> = {
  AUTH: 'AUTH',
  RATE_LIMIT: 'RATE_LIMIT',
  TIMEOUT: 'TIMEOUT',
  PROVIDER: 'PROVIDER',
  VALIDATION: 'VALIDATION',
  NETWORK: 'NETWORK',
  INTERNAL: 'INTERNAL',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Map an unknown error to the ErrorCategory taxonomy.
 *
 * Inspects error name, message, and known error codes for classification.
 */
export function classifyErrorForJob(err: unknown): ErrorCategory {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const name = err.name.toLowerCase();

    if (
      msg.includes('401') ||
      msg.includes('403') ||
      msg.includes('unauthorized') ||
      msg.includes('auth') ||
      msg.includes('api key')
    ) {
      return ErrorCategory.AUTH;
    }
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('throttl')) {
      return ErrorCategory.RATE_LIMIT;
    }
    if (
      name === 'aborterror' ||
      msg.includes('timeout') ||
      msg.includes('timed out')
    ) {
      return ErrorCategory.TIMEOUT;
    }
    if (
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('network') ||
      msg.includes('dns') ||
      msg.includes('connection')
    ) {
      return ErrorCategory.NETWORK;
    }
    if (
      msg.includes('500') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504') ||
      msg.includes('provider') ||
      msg.includes('upstream')
    ) {
      return ErrorCategory.PROVIDER;
    }
    if (
      msg.includes('validation') ||
      msg.includes('invalid') ||
      msg.includes('schema') ||
      msg.includes('required')
    ) {
      return ErrorCategory.VALIDATION;
    }
    if (
      msg.includes('internal') ||
      msg.includes('unexpected') ||
      msg.includes('panic')
    ) {
      return ErrorCategory.INTERNAL;
    }
  }

  return ErrorCategory.UNKNOWN;
}
