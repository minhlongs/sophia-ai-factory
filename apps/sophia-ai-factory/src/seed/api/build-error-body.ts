/**
 * Centralized API error response builder.
 * ALL API error responses MUST route through this utility.
 *
 * Prevents: stack trace leakage, inconsistent error shapes, information disclosure.
 *
 * @module seed/api/build-error-body
 */

import { NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';

export interface ApiErrorBody {
  error: string;
  code: string;
  timestamp: string;
  /** Only included in non-production environments */
  details?: string;
}

/**
 * Build a safe, sanitized error response body.
 * Stack traces and internal details are NEVER included in production.
 *
 * @param error - Human-readable error message (safe for end users)
 * @param code - Machine-readable error code (e.g., 'VALIDATION_ERROR', 'UNAUTHORIZED')
 * @param details - Optional technical details (only included in non-production)
 */
export function buildErrorBody(
  error: string,
  code: string,
  details?: string,
): ApiErrorBody {
  logger.error(`[API] ${code}: ${error}`, details ? { details } : undefined);

  const body: ApiErrorBody = {
    error,
    code,
    timestamp: new Date().toISOString(),
  };

  if (details && process.env.NODE_ENV !== 'production') {
    body.details = details;
  }

  return body;
}

/**
 * Create a sanitized error response.
 * Use this for ALL API error responses.
 *
 * Returns `NextResponse` (not bare `Response`) because Sophia route handlers are
 * declared `Promise<NextResponse>` and `withRateLimit()` requires that signature.
 * `NextResponse` extends `Response`, so handlers typed either way accept this.
 */
export function errorResponse(
  error: string,
  code: string,
  status: number,
  details?: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(buildErrorBody(error, code, details), { status });
}

/**
 * Handle unknown thrown errors safely.
 * Normalizes any thrown value into a safe error response.
 * NEVER exposes raw error messages or stack traces to the client.
 */
export function handleThrownError(
  thrown: unknown,
  fallbackMessage: string,
  code: string,
  status: number = 500,
): NextResponse<ApiErrorBody> {
  const message = thrown instanceof Error ? thrown.message : fallbackMessage;
  const details = thrown instanceof Error ? thrown.stack : undefined;

  logger.error(`[API] ${code}: ${message}`, { thrown: String(thrown) });

  return errorResponse(fallbackMessage, code, status, details);
}
