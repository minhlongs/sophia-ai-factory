import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS middleware utilities
 *
 * Handles Cross-Origin Resource Sharing for API routes and preflight requests.
 */

/**
 * Handle CORS preflight (OPTIONS) requests.
 * Returns appropriate CORS headers for the origin.
 */
export function handleCorsPrelight(origin: string | null): NextResponse {
  const response = NextResponse.json({}, { status: 200 });

  // Allow the requesting origin if it's present
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours

  return response;
}

/**
 * Apply CORS headers to an existing response.
 * Used for non-preflight requests that need CORS.
 */
export function applyCorsHeaders(
  response: NextResponse,
  origin: string | null
): NextResponse {
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');

  return response;
}
