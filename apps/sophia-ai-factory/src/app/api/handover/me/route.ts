/**
 * GET /api/handover/me
 * Returns current user's handover record (if any) for the onboarding banner.
 * Authenticated user fetches their OWN handover — no admin required.
 *
 * Round-10 F-7 reroute: previously mounted at /api/admin/handover/customer-status
 * which broke generic /api/admin/* RBAC audits. Old path keeps a 308 redirect
 * for one release cycle to avoid breaking pinned mobile clients.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserOrOpenclawBearer } from '@/seed/auth/openclaw-token';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { CustomerHandoverRow } from '@/tree/handover/handover-types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserOrOpenclawBearer(request.headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getD1();
    if (!db) throw new Error('D1 database binding not available');
    const row = await db
      .prepare(
        `SELECT id, agency_name, tier, customer_first_login_at,
                customer_first_sop_install_at, customer_first_run_at, status
         FROM customer_handovers
         WHERE customer_user_id = ?1
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .bind(user.id)
      .first<Pick<
        CustomerHandoverRow,
        'id' | 'agency_name' | 'tier' | 'customer_first_login_at' |
        'customer_first_sop_install_at' | 'customer_first_run_at' | 'status'
      >>();

    if (!row) {
      return NextResponse.json({ handover: null });
    }

    return NextResponse.json({
      handover: {
        handoverId: row.id,
        agencyName: row.agency_name,
        tier: row.tier,
        firstLoginAt: row.customer_first_login_at,
        firstSopInstallAt: row.customer_first_sop_install_at,
        firstRunAt: row.customer_first_run_at,
        status: row.status,
      },
    });
  } catch (err) {
    logger.error('[HandoverMe] Query failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ handover: null });
  }
}
