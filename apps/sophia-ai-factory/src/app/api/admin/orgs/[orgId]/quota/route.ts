import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

const OrgQuotaOverrideSchema = z.object({
  missions: z.number().int().positive().optional(),
  credentials: z.number().int().positive().optional(),
  members: z.number().int().positive().optional(),
  webhooks: z.number().int().positive().optional(),
  apiKeys: z.number().int().positive().optional(),
});

export const dynamic = 'force-dynamic';

function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof NextResponse) return auth;
  const adminUserId = auth.user.id;

  try {
    const { orgId } = await params;
    const body = await request.json();
    const parsed = OrgQuotaOverrideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updates = parsed.data;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No overrides provided' }, { status: 400 });
    }

    const db = getD1();
    if (!db) {
      logger.error('[OrgQuotaOverride] D1 binding not available');
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const updateKeys = Object.keys(updates) as (keyof typeof updates)[];
    const updateColumns = updateKeys.map(k => camelToSnake(k));
    const bindValues: unknown[] = [orgId];
    for (const key of updateKeys) {
      bindValues.push(updates[key]);
    }
    bindValues.push(adminUserId);
    bindValues.push(Math.floor(Date.now() / 1000));

    const columnList = ['org_id', ...updateColumns, 'set_by', 'set_at'];
    const placeholders = columnList.map((_, i) => `?${i + 1}`).join(', ');
    const updateSet = [...updateColumns, 'set_by', 'set_at'].map(col => `${col}=excluded.${col}`).join(', ');

    const sql = `
      INSERT INTO org_quota_overrides (${columnList.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT(org_id) DO UPDATE SET ${updateSet}
    `;

    await db.prepare(sql).bind(...bindValues).run();

    logger.info('[OrgQuotaOverride] Set', { orgId, setBy: adminUserId, overrides: updates });
    return NextResponse.json({ success: true, orgId, overrides: updates });
  } catch (error) {
    logger.error('[OrgQuotaOverride] PATCH failed', toError(error));
    return NextResponse.json({ error: 'Failed to set quota override' }, { status: 500 });
  }
}
