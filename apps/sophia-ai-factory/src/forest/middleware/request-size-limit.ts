/**
 * @module middleware/request-size-limit
 * Request size limiting middleware — rejects oversized payloads at the edge.
 * Used by src/middleware.ts and src/forest/middleware/api-pipeline.ts
 * for API route size protection.
 */

import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ─── Constants ───────────────────────────────────────────────────────────────

export const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB default for API routes
export const MAX_WEBHOOK_SIZE = 50 * 1024 * 1024; // 50MB for webhook endpoints

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isWebhookRoute(pathname: string): boolean {
  return pathname.startsWith('/api/webhooks/');
}

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

export function getSizeLimit(pathname: string): number {
  return isWebhookRoute(pathname) ? MAX_WEBHOOK_SIZE : MAX_REQUEST_SIZE;
}
