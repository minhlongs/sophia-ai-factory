import { NextResponse } from 'next/server';;
/**
 * CORS middleware utilities
 *
 * Handles Cross-Origin Resource Sharing for API routes and preflight requests.
 * M12 fix (2026-07-01): Origin allowlist replaces wildcard echo.
 */

/** Allowed origins — configured via env var, comma-separated. */
function getAllowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (!raw) {
    // Default: same-origin only (no cross-origin CORS)
    return [];
  }
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

/** Check if origin is in the allowlist. */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = getAllowedOrigins();
  if (allowed.length === 0) return false;
  return allowed.some(a => a === origin || a === '*');
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 * Returns appropriate CORS headers for allowed origins.
 */
export function handleCorsPrelight(origin: string | null): NextResponse {
  if (!origin || !isOriginAllowed(origin)) {
    return NextResponse.json({}, { status: 204 });
  }

  const response = NextResponse.json({}, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Vary', 'Origin');
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
  if (origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');

  return response;
}
