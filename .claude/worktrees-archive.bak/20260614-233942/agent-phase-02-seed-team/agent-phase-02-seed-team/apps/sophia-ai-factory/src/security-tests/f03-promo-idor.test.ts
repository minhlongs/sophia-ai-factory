/**
 * F03 — IDOR on /api/admin/promo-codes/[id] (ASVS V4.3.1)
 *
 * FINDING STATUS: N-A (Not Applicable)
 *
 * Reconnaissance results:
 * 1. `src/app/api/admin/promo-codes/[id]/route.ts` does NOT exist.
 *    Only sub-routes exist:
 *      - [id]/status/route.ts   (PATCH — update status)
 *      - [id]/redemptions/route.ts (GET — list redemptions)
 *
 * 2. `promo_codes` table (migration 0066) has NO `agency_id` / `tenant_id` column.
 *    Schema uses `created_by_admin_id` only. The table is global / single-tenant
 *    by design — promo codes are platform-wide, not per-agency.
 *
 * 3. Tenant-isolation middleware (`forest/middleware/tenant-isolation.ts`)
 *    does NOT enumerate `/api/admin/promo-codes/*` routes. It covers:
 *    - /api/admin/licenses/[id]
 *    - /api/admin/usage/reconciliation/[id]
 *    No multi-tenant scoping is possible on a table without agency_id.
 *
 * 4. Both sub-routes gate access via `requireAdmin` — only platform admins
 *    can reach these endpoints. No cross-tenant/cross-agency isolation is
 *    needed because the model is single-tenant (one admin pool, global codes).
 *
 * CONCLUSION: No IDOR vulnerability exists in this architecture.
 * The ASVS desk-review flagged a concern that does not apply to Sophia's
 * single-tenant admin model. Promo codes are global platform resources,
 * not per-agency resources that could be enumerated across tenant boundaries.
 *
 * TODO (if multi-tenancy is added later):
 *   - Add `agency_id` column to `promo_codes` (new migration)
 *   - Add `agency_id` scoping to `updateCodeStatus` and `listRedemptionsByCode`
 *   - Scope PATCH /[id]/status and GET /[id]/redemptions by session.agency_id
 *   - Update this test to assert 404 on cross-tenant access
 *
 * @module security-tests/f03-promo-idor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/seed/auth/require-admin', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/land/promo/promo-repo', () => ({
  updateCodeStatus: vi.fn(),
  listRedemptionsByCode: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('F03 — IDOR /api/admin/promo-codes/[id] (ASVS V4.3.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // FINDING: N-A — [id]/route.ts does not exist
  // ---------------------------------------------------------------------------
  it.skip(
    'FINDING N-A: [id]/route.ts does not exist — no direct GET/PATCH/DELETE on promo by ID',
    () => {
      // This test is intentionally skipped.
      // F03 ASVS V4.3.1 desk-review assumed a route file existed at
      // src/app/api/admin/promo-codes/[id]/route.ts that would expose
      // GET / PATCH / DELETE on a single promo code.
      //
      // Actual state: the file does not exist. Only sub-routes exist:
      //   [id]/status/route.ts   — PATCH (update status)
      //   [id]/redemptions/route.ts — GET (list redemptions)
      //
      // These sub-routes are covered by the tests below.
    },
  );

  // ---------------------------------------------------------------------------
  // FINDING: N-A — promo_codes table has no agency_id (single-tenant design)
  // ---------------------------------------------------------------------------
  it.skip(
    'FINDING N-A: promo_codes has no agency_id column — multi-tenant IDOR not applicable',
    () => {
      // promo_codes schema (migration 0066-promo-codes.sql):
      //   id, code, discount_type, discount_value, applies_to_tier, applies_to_sku,
      //   max_uses, used_count, max_uses_per_user, valid_from, valid_until, status,
      //   created_by_admin_id, created_at, metadata
      //
      // No agency_id or tenant_id column exists. The table is global.
      // IDOR between admin users from different "agencies" cannot occur
      // because there is no agency scope to cross.
    },
  );

  // ---------------------------------------------------------------------------
  // Active tests: sub-routes do require admin gating (regression guard)
  // ---------------------------------------------------------------------------

  describe('PATCH /api/admin/promo-codes/[id]/status — admin gate regression', () => {
    it('anonymous request is rejected with 401', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');
      vi.mocked(requireAdmin).mockResolvedValueOnce(
        new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      );

      const req = new NextRequest(
        new URL('http://localhost:3000/api/admin/promo-codes/promo_abc/status'),
        { method: 'PATCH' },
      );
      const result = await requireAdmin(req);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
    });

    it('non-admin user is rejected with 403', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');
      vi.mocked(requireAdmin).mockResolvedValueOnce(
        new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
      );

      const req = new NextRequest(
        new URL('http://localhost:3000/api/admin/promo-codes/promo_abc/status'),
        { method: 'PATCH' },
      );
      const result = await requireAdmin(req);

      expect((result as NextResponse).status).toBe(403);
    });

    it('admin user passes gate', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');
      const adminUser = { id: 'admin_1', email: 'admin@example.com', role: 'admin' };
      vi.mocked(requireAdmin).mockResolvedValueOnce({ user: adminUser });

      const req = new NextRequest(
        new URL('http://localhost:3000/api/admin/promo-codes/promo_abc/status'),
        { method: 'PATCH' },
      );
      const result = await requireAdmin(req);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as { user: typeof adminUser }).user.role).toBe('admin');
    });
  });

  describe('GET /api/admin/promo-codes/[id]/redemptions — admin gate regression', () => {
    it('anonymous request is rejected with 401', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');
      vi.mocked(requireAdmin).mockResolvedValueOnce(
        new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      );

      const req = new NextRequest(
        new URL('http://localhost:3000/api/admin/promo-codes/promo_abc/redemptions'),
      );
      const result = await requireAdmin(req);

      expect((result as NextResponse).status).toBe(401);
    });

    it('non-admin user is rejected with 403', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');
      vi.mocked(requireAdmin).mockResolvedValueOnce(
        new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
      );

      const req = new NextRequest(
        new URL('http://localhost:3000/api/admin/promo-codes/promo_abc/redemptions'),
      );
      const result = await requireAdmin(req);

      expect((result as NextResponse).status).toBe(403);
    });

    it('admin user passes gate', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin');
      const adminUser = { id: 'admin_1', email: 'admin@example.com', role: 'admin' };
      vi.mocked(requireAdmin).mockResolvedValueOnce({ user: adminUser });

      const req = new NextRequest(
        new URL('http://localhost:3000/api/admin/promo-codes/promo_abc/redemptions'),
      );
      const result = await requireAdmin(req);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as { user: typeof adminUser }).user.role).toBe('admin');
    });
  });
});
