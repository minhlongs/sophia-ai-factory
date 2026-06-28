/**
 * Tenant Context — resolve tenant identity from Better Auth session.
 *
 * tenantId NEVER comes from query/body — only from verified session.
 * Single-tenant fallback: use user.id if tenantId not explicitly set.
 *
 * @module raas/tenant-context
 */

import { NextResponse } from 'next/server';

/** Shape we accept from Better Auth session objects */
export interface SessionLike {
  user: {
    id: string;
    email: string;
    /** Optional tenant field set by Better Auth plugin or token claim */
    tenantId?: string;
    /** Role claim — used by admin gate */
    role?: string;
  };
}

/**
 * Resolve tenant ID from session.
 * Returns tenantId field if present, otherwise falls back to user.id
 * (single-tenant mode: 1 user = 1 tenant).
 * Returns null if session is null/undefined.
 */
export function resolveTenantId(session: SessionLike | null | undefined): string | null {
  if (!session?.user) return null;
  return session.user.tenantId ?? session.user.id;
}

/**
 * Require tenant ID — throws 401 JSON response if not resolvable.
 * Use this in API routes that MUST have a tenant context.
 */
export function requireTenantId(session: SessionLike | null | undefined): string {
  const tid = resolveTenantId(session);
  if (!tid) {
    throw new TenantAuthError('Unauthenticated: no tenant context');
  }
  return tid;
}

/**
 * Require admin role — throws 403 JSON response if role !== 'admin'.
 */
export function requireAdmin(session: SessionLike | null | undefined): void {
  if (!session?.user || session.user.role !== 'admin') {
    throw new TenantAuthError('Forbidden: admin role required', 403);
  }
}

/** Error class for tenant auth failures — carries HTTP status code */
export class TenantAuthError extends Error {
  constructor(
    message: string,
    public readonly status: number = 401,
  ) {
    super(message);
    this.name = 'TenantAuthError';
  }

  toResponse(): NextResponse {
    return NextResponse.json({ error: this.message }, { status: this.status });
  }
}
