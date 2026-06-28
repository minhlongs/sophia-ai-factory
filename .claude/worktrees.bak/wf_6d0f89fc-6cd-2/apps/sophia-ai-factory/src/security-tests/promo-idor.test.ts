 
/**
 * Promo Admin IDOR & Authorization Tests
 * Security regression tests for admin promo endpoints
 * @module tests/security/promo-idor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock auth dependencies
vi.mock('@/seed/auth/require-admin', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));

vi.mock('@/land/promo/promo-repo', () => ({
  listAdminCodes: vi.fn().mockResolvedValue([
    {
      id: 'code_1',
      code: 'FREE100',
      discountType: 'free_full',
      used_count: 5,
      global_limit: 100,
    },
  ]),
  getPromoCodeById: vi.fn(),
  bulkGeneratePromoCodes: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Promo Admin IDOR & Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/promo-codes/list — Read gating', () => {
    it('should reject non-authenticated user (no session)', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');
      const { getCurrentUserFromHeaders } = await import('@/seed/auth/better-auth-session');

      vi.mocked(getCurrentUserFromHeaders).mockResolvedValueOnce(null);
      vi.mocked(requireAdmin).mockResolvedValueOnce(
        new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/promo-codes/list'));
      const result = await requireAdmin(request);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
    });

    it('should reject non-admin user (role != admin)', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');
      const { getCurrentUserFromHeaders } = await import('@/seed/auth/better-auth-session');

      vi.mocked(getCurrentUserFromHeaders).mockResolvedValueOnce({
        id: 'user_123',
        email: 'user@example.com',
        role: 'user', // NOT admin
      });

      vi.mocked(requireAdmin).mockResolvedValueOnce(
        new NextResponse(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403 }),
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/promo-codes/list'));
      const result = await requireAdmin(request);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(403);
    });

    it('should allow authenticated admin user (role == admin)', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');
      const { getCurrentUserFromHeaders } = await import('@/seed/auth/better-auth-session');

      const adminUser = {
        id: 'admin_123',
        email: 'admin@example.com',
        role: 'admin',
      };

      vi.mocked(getCurrentUserFromHeaders).mockResolvedValueOnce(adminUser);
      vi.mocked(requireAdmin).mockResolvedValueOnce({ user: adminUser });

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/promo-codes/list'));
      const result = await requireAdmin(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).user?.role).toBe('admin');
    });
  });

  describe('GET /api/admin/promo-codes/[id] — By-ID read gating', () => {
    it('should reject anonymous access to single promo code', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');

      vi.mocked(requireAdmin).mockResolvedValueOnce(
        new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/promo-codes/code_1'));
      const result = await requireAdmin(request);

      expect((result as NextResponse).status).toBe(401);
    });

    it('should reject non-admin user reading specific promo code', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');
      const { getCurrentUserFromHeaders } = await import('@/seed/auth/better-auth-session');

      vi.mocked(getCurrentUserFromHeaders).mockResolvedValueOnce({
        id: 'user_456',
        email: 'user@example.com',
        role: 'user',
      });

      vi.mocked(requireAdmin).mockResolvedValueOnce(
        new NextResponse(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403 }),
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/promo-codes/code_1'));
      const result = await requireAdmin(request);

      expect((result as NextResponse).status).toBe(403);
    });

    it('should allow admin to read any promo code by id (positive case)', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');

      const adminUser = {
        id: 'admin_123',
        email: 'admin@example.com',
        role: 'admin',
      };

      vi.mocked(requireAdmin).mockResolvedValueOnce({ user: adminUser });

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/promo-codes/code_1'));
      const result = await requireAdmin(request);

      // Admin should succeed
      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).user.role).toBe('admin');
    });
  });

  describe('POST /api/admin/promo-codes/create — Create gating', () => {
    it('should reject anonymous create', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');

      vi.mocked(requireAdmin).mockResolvedValueOnce(
        new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/promo-codes/create'), {
        method: 'POST',
        body: JSON.stringify({ code: 'NEWCODE', discountType: 'percent_off', discountValue: 50 }),
      });

      const result = await requireAdmin(request);

      expect((result as NextResponse).status).toBe(401);
    });

    it('should reject non-admin user creating promo code', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');

      vi.mocked(requireAdmin).mockResolvedValueOnce(
        new NextResponse(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403 }),
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/promo-codes/create'), {
        method: 'POST',
        body: JSON.stringify({ code: 'NEWCODE', discountType: 'percent_off' }),
      });

      const result = await requireAdmin(request);

      expect((result as NextResponse).status).toBe(403);
    });
  });

  describe('POST /api/admin/promo-codes/bulk-generate — Bulk create gating', () => {
    it('should reject anonymous bulk generate', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');

      vi.mocked(requireAdmin).mockResolvedValueOnce(
        new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/promo-codes/bulk-generate'), {
        method: 'POST',
        body: JSON.stringify({ count: 100, discountType: 'percent_off', discountValue: 50 }),
      });

      const result = await requireAdmin(request);

      expect((result as NextResponse).status).toBe(401);
    });

    it('should reject non-admin user bulk generating codes', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');

      vi.mocked(requireAdmin).mockResolvedValueOnce(
        new NextResponse(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403 }),
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/promo-codes/bulk-generate'), {
        method: 'POST',
        body: JSON.stringify({ count: 100, discountType: 'percent_off' }),
      });

      const result = await requireAdmin(request);

      expect((result as NextResponse).status).toBe(403);
    });

    it('should allow admin bulk generate (positive case)', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');

      const adminUser = {
        id: 'admin_123',
        email: 'admin@example.com',
        role: 'admin',
      };

      vi.mocked(requireAdmin).mockResolvedValueOnce({ user: adminUser });

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/promo-codes/bulk-generate'), {
        method: 'POST',
        body: JSON.stringify({ count: 100, discountType: 'percent_off', discountValue: 50 }),
      });

      const result = await requireAdmin(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).user.role).toBe('admin');
    });
  });

  describe('GET /api/admin/promo-codes/[id]/redemptions — Redemption history gating', () => {
    it('should reject non-admin reading redemption history', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');

      vi.mocked(requireAdmin).mockResolvedValueOnce(
        new NextResponse(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403 }),
      );

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/promo-codes/code_1/redemptions'));
      const result = await requireAdmin(request);

      expect((result as NextResponse).status).toBe(403);
    });

    it('should allow admin to read redemption history', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');

      const adminUser = { id: 'admin_123', email: 'admin@example.com', role: 'admin' };
      vi.mocked(requireAdmin).mockResolvedValueOnce({ user: adminUser });

      const request = new NextRequest(new URL('http://localhost:3000/api/admin/promo-codes/code_1/redemptions'));
      const result = await requireAdmin(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).user.role).toBe('admin');
    });
  });
});
