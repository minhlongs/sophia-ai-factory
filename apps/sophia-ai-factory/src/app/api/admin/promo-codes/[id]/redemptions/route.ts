/**
 * GET /api/admin/promo-codes/[id]/redemptions
 * List redemptions for a specific promo code.
 * Admin only.
 * @module app/api/admin/promo-codes/[id]/redemptions
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listRedemptionsByCode } from '@/lib/promo/promo-repo';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const limit = sp.get('limit') ? parseInt(sp.get('limit')!) : 50;
  const offset = sp.get('offset') ? parseInt(sp.get('offset')!) : 0;

  const redemptions = await listRedemptionsByCode(id, limit, offset);
  return NextResponse.json({ redemptions, count: redemptions.length });
}
