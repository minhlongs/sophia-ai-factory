/**
 * GET /api/admin/handover/list
 * Returns handovers joined with user (email, name).
 *
 * Query params:
 *   status:  pending | active | at_risk | churned (optional)
 *   limit:   default 50, max 100
 *   offset:  default 0
 *   stats:   if "1", returns aggregate counts instead of rows
 *
 * @module app/api/admin/handover/list/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['pending', 'active', 'at_risk', 'churned'] as const;

interface HandoverListRow {
  id: string;
  customer_user_id: string;
  email: string | null;
  name: string | null;
  agency_name: string;
  tier: string;
  status: string;
  source: string;
  created_at: number;
  welcome_email_sent_at: number | null;
  customer_first_login_at: number | null;
  customer_first_run_at: number | null;
}

interface HandoverStats {
  total: number;
  pending: number;
  active: number;
  at_risk: number;
  churned: number;
  email_sent: number;
  first_login: number;
  first_run: number;
  // Customers stuck in onboarding: email sent but never logged in
  stuck_no_login: number;
  // Customers logged in but never ran a workflow
  stuck_no_run: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const wantStats = url.searchParams.get('stats') === '1';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100);
  const offset = Number(url.searchParams.get('offset') ?? '0');

  try {
    const db = getD1();
    if (!db) throw new Error('D1 database binding not available');

    if (wantStats) {
      const row = await db
        .prepare(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) AS pending,
             SUM(CASE WHEN status='active'   THEN 1 ELSE 0 END) AS active,
             SUM(CASE WHEN status='at_risk'  THEN 1 ELSE 0 END) AS at_risk,
             SUM(CASE WHEN status='churned'  THEN 1 ELSE 0 END) AS churned,
             SUM(CASE WHEN welcome_email_sent_at      IS NOT NULL THEN 1 ELSE 0 END) AS email_sent,
             SUM(CASE WHEN customer_first_login_at    IS NOT NULL THEN 1 ELSE 0 END) AS first_login,
             SUM(CASE WHEN customer_first_run_at      IS NOT NULL THEN 1 ELSE 0 END) AS first_run,
             SUM(CASE WHEN welcome_email_sent_at      IS NOT NULL
                       AND customer_first_login_at    IS NULL     THEN 1 ELSE 0 END) AS stuck_no_login,
             SUM(CASE WHEN customer_first_login_at    IS NOT NULL
                       AND customer_first_run_at      IS NULL     THEN 1 ELSE 0 END) AS stuck_no_run
           FROM customer_handovers`,
        )
        .first<HandoverStats>();
      return NextResponse.json({ stats: row });
    }

    const baseSelect = `
      SELECT h.id, h.customer_user_id, u.email, u.name,
             h.agency_name, h.tier, h.status, h.source,
             h.created_at, h.welcome_email_sent_at,
             h.customer_first_login_at, h.customer_first_run_at
      FROM customer_handovers h
      LEFT JOIN user u ON u.id = h.customer_user_id
    `;

    const isValidStatus = status !== null && (VALID_STATUSES as readonly string[]).includes(status);
    const query = isValidStatus
      ? `${baseSelect} WHERE h.status = ?1 ORDER BY h.created_at DESC LIMIT ?2 OFFSET ?3`
      : `${baseSelect} ORDER BY h.created_at DESC LIMIT ?1 OFFSET ?2`;
    const bindings = isValidStatus ? [status, limit, offset] : [limit, offset];

    const { results } = await db
      .prepare(query)
      .bind(...bindings)
      .all<HandoverListRow>();

    return NextResponse.json({ handovers: results });
  } catch (err) {
    logger.error('[Handover/List] Query failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Failed to fetch handovers' }, { status: 500 });
  }
}
