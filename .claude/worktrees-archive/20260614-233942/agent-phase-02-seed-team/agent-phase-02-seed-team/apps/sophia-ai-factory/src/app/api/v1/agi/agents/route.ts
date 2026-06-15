/**
 * GET /api/v1/agi/agents — Recent agent sessions, tasks, and stats.
 * Auth: Better Auth session.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  getRecentSessions,
  getTasksForSessions,
  getSessionStats,
} from '@/seed/db/repositories/agent-sessions-repo';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof getCurrentUser>> | null = null;
  try {
    user = await getCurrentUser();
  } catch { /* unauth */ }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [sessions, stats] = await Promise.all([
      getRecentSessions(20),
      getSessionStats(),
    ]);

    const sessionIds = sessions.map((s) => s.id);
    const tasksBySession = await getTasksForSessions(sessionIds);

    return NextResponse.json({ sessions, tasksBySession, stats });
  } catch (err) {
    logger.error('[API] GET /agi/agents failed', { error: getErrorMessage(err) });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
