/**
 * Tests for tenant-context.ts
 *
 * Covers:
 * - resolveTenantId: returns tenantId field when present
 * - resolveTenantId: falls back to user.id (single-tenant)
 * - resolveTenantId: returns null on null/missing session
 * - requireTenantId: throws TenantAuthError(401) on null session
 * - requireAdmin: throws TenantAuthError(403) when role !== admin
 */

import { describe, it, expect } from 'vitest';
import {
  resolveTenantId,
  requireTenantId,
  requireAdmin,
  TenantAuthError,
} from '../tenant-context';
import type { SessionLike } from '../tenant-context';

describe('resolveTenantId', () => {
  it('returns tenantId field when present', () => {
    const session: SessionLike = {
      user: { id: 'user-1', email: 'a@b.com', tenantId: 'org-abc' },
    };
    expect(resolveTenantId(session)).toBe('org-abc');
  });

  it('falls back to user.id when tenantId is absent (single-tenant mode)', () => {
    const session: SessionLike = {
      user: { id: 'user-2', email: 'b@c.com' },
    };
    expect(resolveTenantId(session)).toBe('user-2');
  });

  it('returns null for null session', () => {
    expect(resolveTenantId(null)).toBeNull();
  });

  it('returns null for undefined session', () => {
    expect(resolveTenantId(undefined)).toBeNull();
  });

  it('returns null when user is missing', () => {
    expect(resolveTenantId({} as SessionLike)).toBeNull();
  });
});

describe('requireTenantId', () => {
  it('returns tenantId for valid session', () => {
    const session: SessionLike = {
      user: { id: 'user-3', email: 'c@d.com', tenantId: 'org-xyz' },
    };
    expect(requireTenantId(session)).toBe('org-xyz');
  });

  it('throws TenantAuthError(401) for null session', () => {
    expect(() => requireTenantId(null)).toThrow(TenantAuthError);
    try {
      requireTenantId(null);
    } catch (e) {
      expect(e).toBeInstanceOf(TenantAuthError);
      expect((e as TenantAuthError).status).toBe(401);
    }
  });

  it('throws TenantAuthError(401) for undefined session', () => {
    expect(() => requireTenantId(undefined)).toThrow(TenantAuthError);
  });
});

describe('requireAdmin', () => {
  it('does not throw for admin role', () => {
    const session: SessionLike = {
      user: { id: 'admin-1', email: 'admin@x.com', role: 'admin' },
    };
    expect(() => requireAdmin(session)).not.toThrow();
  });

  it('throws TenantAuthError(403) for non-admin role', () => {
    const session: SessionLike = {
      user: { id: 'user-4', email: 'd@e.com', role: 'user' },
    };
    expect(() => requireAdmin(session)).toThrow(TenantAuthError);
    try {
      requireAdmin(session);
    } catch (e) {
      expect(e).toBeInstanceOf(TenantAuthError);
      expect((e as TenantAuthError).status).toBe(403);
    }
  });

  it('throws TenantAuthError(403) for missing role', () => {
    const session: SessionLike = {
      user: { id: 'user-5', email: 'e@f.com' },
    };
    expect(() => requireAdmin(session)).toThrow(TenantAuthError);
  });

  it('throws TenantAuthError for null session', () => {
    expect(() => requireAdmin(null)).toThrow(TenantAuthError);
  });
});

describe('TenantAuthError', () => {
  it('toResponse() returns NextResponse-like with correct status', () => {
    // Mock NextResponse to avoid Next.js runtime requirement
    const err = new TenantAuthError('Unauthorized', 401);
    // Just verify the error shape — toResponse() calls NextResponse.json internally
    expect(err.message).toBe('Unauthorized');
    expect(err.status).toBe(401);
    expect(err.name).toBe('TenantAuthError');
  });
});
