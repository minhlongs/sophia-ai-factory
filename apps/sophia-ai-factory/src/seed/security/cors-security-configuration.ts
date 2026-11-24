/**
 * CORS Security Configuration
 * Restrict origins để chống unauthorized access
 */

import { NextResponse } from 'next/server';
import { getEffectiveAllowedHosts } from '@/seed/domain';

function resolveAllowedCorsOrigins(): Set<string> {
  const origins = new Set<string>([
    'https://sophia-ai-factory.pages.dev',
  ]);
  for (const host of getEffectiveAllowedHosts()) {
    if (host === 'localhost' || host === '127.0.0.1') {
      if (process.env.NODE_ENV !== 'production') {
        origins.add(`http://${host}:3000`);
        origins.add(`http://${host}:3001`);
      }
      continue;
    }
    origins.add(`https://${host}`);
  }
  return origins;
}

/**
 * Check if origin is allowed (exact match against runtime technical, env,
 * and active brand-domain hosts — never wildcards).
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return resolveAllowedCorsOrigins().has(origin);
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
