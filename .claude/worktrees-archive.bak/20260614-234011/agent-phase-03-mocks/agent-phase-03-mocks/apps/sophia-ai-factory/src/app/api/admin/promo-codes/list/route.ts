/**
 * GET /api/admin/promo-codes/list
 * List all promo codes with optional filters.
 * Admin only.
 * @module app/api/admin/promo-codes/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { listAdminCodes } from '@/land/promo/promo-repo';
import type { ListAdminFilters, PromoCodeStatus, DiscountType } from '@/land/promo/promo-types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const sp = request.nextUrl.searchParams;
  const filters: ListAdminFilters = {
    status: (sp.get('status') as PromoCodeStatus) ?? undefined,
    discountType: (sp.get('discount_type') as DiscountType) ?? undefined,
    appliesToTier: sp.get('tier') ?? undefined,
    limit: sp.get('limit') ? parseInt(sp.get('limit')!) : 50,
    offset: sp.get('offset') ? parseInt(sp.get('offset')!) : 0,
  };

  const codes = await listAdminCodes(filters);
  return NextResponse.json({ codes, count: codes.length });
}
