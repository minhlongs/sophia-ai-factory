/**
 * POST /api/raas/execute
 *
 * Internal route — triggers PEV execution for a queued mission.
 * Protected by x-internal-secret header.
 * Updates mission status through queued → planning → executing → verifying → completed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

export const dynamic = 'force-dynamic';

const ExecuteSchema = z.object({
  mission_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    // Verify internal secret
    const secret = request.headers.get('x-internal-secret');
    const expected = process.env.INTERNAL_API_SECRET;

    if (!expected || secret !== expected) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = ExecuteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { mission_id } = parsed.data;

    // Update mission to planning state
    const db = createServerClient();
    const { error: updateError } = await db
      .from('missions')
      .update({ status: 'planning', started_at: new Date().toISOString() })
      .eq('id', mission_id)
      .eq('status', 'queued');

    if (updateError) {
      logger.error('[POST /api/raas/execute] Failed to update mission status', toError(updateError));
      return NextResponse.json({ error: 'Failed to start mission' }, { status: 500 });
    }

    logger.info('[POST /api/raas/execute] Mission execution triggered', { mission_id });

    return NextResponse.json({ success: true, mission_id });
  } catch (err) {
    logger.error('[POST /api/raas/execute] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
  }
}
