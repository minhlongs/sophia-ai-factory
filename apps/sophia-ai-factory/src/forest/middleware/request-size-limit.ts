/**
 * Request size limit middleware for API routes.
 *
 * Enforces maximum request body size to prevent abuse:
 * - Default API routes: 10MB
 * - Webhook routes: 50MB (uncontrolled external payloads)
 *
 * Uses Content-Length header for fast rejection (no body reading).
 * Requests without Content-Length pass through (chunked encoding).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/** Default maximum request size for API routes (10MB) */
export const DEFAULT_MAX_REQUEST_SIZE = 10 * 1024 * 1024;

/** Maximum request size for webhook endpoints (50MB) */
export const MAX_WEBHOOK_SIZE = 50 * 1024 * 1024;

/** Path prefix for webhook routes */
const WEBHOOK_PREFIX = '/api/webhooks/';

/**
 * Check if a pathname is a webhook route.
 */
export function isWebhookRoute(pathname: string): boolean {
  return pathname.startsWith(WEBHOOK_PREFIX);
}

/**
 * Get the maximum allowed request size for a given pathname.
 */
export function getMaxSizeForPath(pathname: string): number {
  return isWebhookRoute(pathname) ? MAX_WEBHOOK_SIZE : DEFAULT_MAX_REQUEST_SIZE;
}

/**
 * Reject an oversized request based on Content-Length header.
 * Returns a 413 response if the request exceeds maxBytes, null otherwise.
 * Requests without Content-Length pass through (body size not known upfront).
 */
export function rejectOversizedRequest(
  request: NextRequest,
  maxBytes: number
): NextResponse | null {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const size = Number(contentLength);
    if (Number.isFinite(size) && size > maxBytes) {
      return NextResponse.json(
        {
          error: 'Payload too large',
          detail: `Request size ${size} bytes exceeds limit of ${maxBytes} bytes`,
        },
        { status: 413 }
      );
    }
  }
  return null;
}

/**
 * Higher-order function to wrap an API route handler with request size limiting.
 *
 * @example
 * export const POST = withRequestSizeLimit(
 *   async (req: NextRequest) => { /* handler *\/ },
 *   10 * 1024 * 1024 // 10MB
 * );
 */
export function withRequestSizeLimit<T>(
  handler: (request: NextRequest) => Promise<T>,
  maxBytes: number = DEFAULT_MAX_REQUEST_SIZE
): (request: NextRequest) => Promise<T> {
  return async (request: NextRequest): Promise<T> => {
    const rejected = rejectOversizedRequest(request, maxBytes);
    if (rejected) {
      // Type assertion: we're returning NextResponse instead of T,
      // but the caller (Next.js route handler) accepts NextResponse
      throw new Error('__SIZE_LIMIT_REJECTED__');
    }
    return handler(request);
  };
}
