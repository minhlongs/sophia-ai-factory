/**
 * POST /api/welcome/milestone
 * Records onboarding milestone completion for the current user.
 * Authenticated — requires Better Auth session.
 * @module app/api/welcome/milestone/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

const MilestoneSchema = z.object({
  step: z.enum(['connectivity', 'api_key', 'first_run']),
});

const STEP_TO_COLUMN: Record<string, string> = {
  connectivity: 'customer_first_login_at',
  api_key: 'customer_first_sop_install_at',
  first_run: 'customer_first_run_at',
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = MilestoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid step', details: parsed.error.flatten() }, { status: 400 });
  }

  const column = STEP_TO_COLUMN[parsed.data.step];
  const nowMs = Date.now();

  try {
    const _db = await getD1();
    if (!_db) {
      logger.error('[Welcome/Milestone] D1 unavailable');
      return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
    }
    const db = _db;
    await db
      .prepare(
        `UPDATE customer_handovers
         SET ${column} = ?1
         WHERE customer_user_id = ?2
           AND ${column} IS NULL`,
      )
      .bind(nowMs, user.id)
      .run();

    logger.info('[Milestone] Recorded', { userId: user.id, step: parsed.data.step });
    return NextResponse.json({ ok: true, step: parsed.data.step });
  } catch (err) {
    logger.error('[Milestone] DB error', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
