/**
 * POST /api/agents/pause — Pause all queued tasks for the org
 * Sets status = 'failed', error_message = 'Paused by user'
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { createServerClient } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = createServerClient();
    const orgId = user.id;

    // Count queued tasks first
    const { count } = await db
      .from('agent_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'queued');

    // Update queued → failed with pause message
    await db
      .from('agent_tasks')
      .update({
        status: 'failed',
        error_message: 'Paused by user',
      })
      .eq('org_id', orgId)
      .eq('status', 'queued');

    return NextResponse.json({ paused: count ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
