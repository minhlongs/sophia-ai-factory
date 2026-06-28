/**
 * GET /api/v1/agi/confidence — Recent confidence scores and escalation requests.
 * Auth: Better Auth session.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getRecentScores, getRecentEscalations } from '@/seed/db/repositories/confidence-escalation-repo';
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
    const [scores, escalations] = await Promise.all([
      getRecentScores(50),
      getRecentEscalations(50),
    ]);
    return NextResponse.json({ scores, escalations });
  } catch (err) {
    logger.error('[API] GET /agi/confidence failed', { error: getErrorMessage(err) });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
