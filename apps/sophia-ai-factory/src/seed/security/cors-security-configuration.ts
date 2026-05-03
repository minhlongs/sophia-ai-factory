/**
 * CORS Security Configuration
 * Restrict origins để chống unauthorized access
 */

import { NextResponse } from 'next/server';

/**
 * Allowed origins for CORS
 * Thêm production domain và development localhost
 */
const ALLOWED_ORIGINS = [
  'https://sophia-ai-factory.pages.dev', // Cloudflare Pages
  'https://sophia.agencyos.network', // Production domain
  ...(process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://localhost:3001']
    : []),
];

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Apply CORS headers to response
 */
export function applyCorsHeaders(
  response: NextResponse,
  origin: string | null
): NextResponse {
  // Chỉ set CORS headers nếu origin được phép
  if (origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Vary', 'Origin');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-CSRF-Token'
    );
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  }

  return response;
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPrelight(origin: string | null): NextResponse {
  if (!origin || !isOriginAllowed(origin)) {
    return new NextResponse(null, { status: 403 });
  }

  const response = new NextResponse(null, { status: 204 });
  return applyCorsHeaders(response, origin);
}
