/**
 * GET/PATCH /api/admin/handover/[id]
 * Get single handover detail or update status.
 *
 * @module app/api/admin/handover/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requireAdminWithRecentAuth } from '@/seed/auth/require-admin';
import { getD1 } from '@/seed/db/client';
import { writeAuditLog } from '@/tree/admin/audit-log';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }> }

const patchSchema = z.object({
  status: z.enum(['pending', 'active', 'at_risk', 'churned']),
});

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    const row = await db
      .prepare(`SELECT * FROM customer_handovers WHERE id = ?1 LIMIT 1`)
      .bind(id)
      .first();

    if (!row) {
      return NextResponse.json({ error: 'Handover not found' }, { status: 404 });
    }

    return NextResponse.json({ handover: row });
  } catch (err) {
    logger.error('[Handover/Get] Query failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Failed to fetch handover' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof Response) return auth;
  const { user: admin } = auth;

  const { id } = await params;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid input', details: getErrorMessage(err) }, { status: 400 });
  }

  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    const result = await db
      .prepare(`UPDATE customer_handovers SET status = ?1 WHERE id = ?2`)
      .bind(body.status, id)
      .run();

    if (!result.meta.changes) {
      return NextResponse.json({ error: 'Handover not found' }, { status: 404 });
    }

    await writeAuditLog({
      actorUserId: admin.id,
      actionType: 'customer_handover_status_changed',
      payload: {
        event: 'handover_status_updated',
        handoverId: id,
        newStatus: body.status,
      },
    });

    return NextResponse.json({ success: true, status: body.status });
  } catch (err) {
    logger.error('[Handover/Patch] Update failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
