import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { consolidateEpisodicToSemantic } from '@/seed/db/repositories/creator-memory-repo';
import { getD1Raw } from '@/seed/db/client';
import { getErrorMessage } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const db = await getD1Raw();
    const activeUsers = await db
      .prepare(
        `SELECT DISTINCT user_id FROM creator_memory
         WHERE memory_type = 'episodic'
           AND created_at >= ?1
         LIMIT 100`,
      )
      .bind(Date.now() - 86_400_000)
      .all<{ user_id: string }>();

    const userIds = (activeUsers.results ?? []).map((r) => r.user_id);
    const results = [];

    for (const userId of userIds) {
      const summary = await consolidateEpisodicToSemantic(userId);
      if (summary.semanticCreated > 0) results.push(summary);
    }

    logger.info('[cron/memory-consolidation] Run complete', {
      usersProcessed: userIds.length,
      consolidations: results.length,
    });

    return NextResponse.json({
      ok: true,
      usersProcessed: userIds.length,
      consolidations: results.length,
      details: results,
    });
  } catch (err) {
    logger.error('[cron/memory-consolidation] Failed', { error: getErrorMessage(err) });
    return NextResponse.json({ ok: false, error: getErrorMessage(err) }, { status: 500 });
  }
}
