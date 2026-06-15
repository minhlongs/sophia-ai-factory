/**
 * GET /api/welcome/status
 * Returns the current user's onboarding milestones.
 * Authenticated — uses Better Auth session.
 *
 * Response:
 *   { handover?: { firstLoginAt, firstSopInstallAt, firstRunAt, status, tier } }
 *
 * @module app/api/welcome/status/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

interface StatusRow {
  customer_first_login_at: number | null;
  customer_first_sop_install_at: number | null;
  customer_first_run_at: number | null;
  status: string;
  tier: string;
  agency_name: string;
  source: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const _db = getD1();
    if (!_db) {
      logger.error('[Welcome/Status] D1 unavailable');
      return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
    }
    const db = _db;
    const row = await db
      .prepare(
        `SELECT customer_first_login_at, customer_first_sop_install_at,
                customer_first_run_at, status, tier, agency_name, source
           FROM customer_handovers
          WHERE customer_user_id = ?1
          ORDER BY created_at DESC
          LIMIT 1`,
      )
      .bind(user.id)
      .first<StatusRow>();

    if (!row) {
      return NextResponse.json({ handover: null });
    }

    return NextResponse.json({
      handover: {
        firstLoginAt: row.customer_first_login_at,
        firstSopInstallAt: row.customer_first_sop_install_at,
        firstRunAt: row.customer_first_run_at,
        status: row.status,
        tier: row.tier,
        agencyName: row.agency_name,
        source: row.source,
      },
    });
  } catch (err) {
    logger.error('[Welcome/Status] DB error', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
