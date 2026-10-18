import { NextRequest, NextResponse } from 'next/server';

export interface TenantIsolationResult {
  allowed: boolean;
  reason?: string;
  agencyId?: string;
  errorCode?: string;
}

export const PUBLIC_ROUTES = [
  '/api/health',
  '/api/setup',
  '/api/webhooks/nowpayments',
  '/api/webhooks/telegram',
  '/api/auth',
  '/api/discovery',
  '/api/sophia-index',
  '/api/login',
  '/auth/callback',
];

export function isBypassedTenantRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) return true;
  if (!pathname.startsWith('/api')) return true;
  if (pathname.startsWith('/_next') || /\.(png|jpg|jpeg|gif|svg|ico)$/.test(pathname)) return true;
  return false;
}

export function buildForbiddenTenantResponse(validationResult: TenantIsolationResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Forbidden',
      message: validationResult.reason || 'Access denied due to tenant isolation',
      code: validationResult.errorCode || 'FORBIDDEN',
    },
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Isolation-Reason': validationResult.errorCode || 'unknown',
      },
    },
  );
}

export function extractAuditMetadata(request: NextRequest, userId: string, isValid: boolean, prefix: string) {
  return {
    nonce: `${prefix}_${Date.now()}`,
    isValid,
    userId,
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    tier: 'MULTI_TENANT_ISO',
  };
}
