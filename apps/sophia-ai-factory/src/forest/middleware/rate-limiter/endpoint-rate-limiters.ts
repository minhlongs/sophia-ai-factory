/**
 * D1-backed auth and admin endpoint rate limiters.
 * @module forest/middleware/rate-limiter/endpoint-rate-limiters
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkD1RateLimit } from '@/seed/security/d1-rate-limiter';

export function getClientIdentifier(request: Request): string {
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    return `apikey:${apiKey}`;
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0].trim();
    return `ip:${ip}`;
  }

  return 'ip:anonymous';
}

const AUTH_ENDPOINT_PATTERNS = [
  '/api/auth/login',
  '/api/auth/mfa/challenge',
  '/api/auth/admin/challenge',
  '/api/auth/sign-up/email',
];

function isAuthEndpoint(pathname: string): boolean {
  return AUTH_ENDPOINT_PATTERNS.some(
    (pattern) => pathname.startsWith(pattern) || pathname === pattern,
  );
}

export async function checkAuthRateLimit(
  request: NextRequest,
): Promise<NextResponse | null> {
  const url = request.nextUrl?.pathname ?? '';
  const pathname = url || new URL(request.url).pathname;

  if (!isAuthEndpoint(pathname)) {
    return null;
  }

  const clientId = getClientIdentifier(request);
  const result = await checkD1RateLimit(clientId, {
    maxRequests: 10,
    windowSeconds: 60,
  });

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: result.resetAt - Math.floor(Date.now() / 1000),
      },
      { status: 429 },
    );
  }

  return null;
}

export const ADMIN_RATE_LIMIT_CONFIG = {
  maxRequests: 100,
  windowSeconds: 60,
} as const;

function isAdminEndpoint(pathname: string): boolean {
  return pathname.startsWith('/dashboard/admin') || pathname.startsWith('/api/admin');
}

function resolveLang(request: NextRequest): 'vi' | 'en' {
  const acceptLanguage = request.headers.get('accept-language') ?? '';
  return acceptLanguage.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

export async function checkAdminRateLimit(
  request: NextRequest,
): Promise<NextResponse | null> {
  const url = request.nextUrl?.pathname ?? '';
  const pathname = url || new URL(request.url).pathname;

  if (!isAdminEndpoint(pathname)) {
    return null;
  }

  const clientId = getClientIdentifier(request);
  const result = await checkD1RateLimit(clientId, {
    maxRequests: ADMIN_RATE_LIMIT_CONFIG.maxRequests,
    windowSeconds: ADMIN_RATE_LIMIT_CONFIG.windowSeconds,
  });

  if (!result.allowed) {
    const retryAfter = result.resetAt - Math.floor(Date.now() / 1000);
    const lang = resolveLang(request);

    const message =
      lang === 'vi'
        ? 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.'
        : 'Rate limit exceeded. Please try again later.';

    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(ADMIN_RATE_LIMIT_CONFIG.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetAt),
        },
      },
    );
  }

  return null;
}
