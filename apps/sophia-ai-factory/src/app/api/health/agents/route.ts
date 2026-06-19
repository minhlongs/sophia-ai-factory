/**
 * GET /api/health/agents
 * Returns agent health metrics (24h window).
 * Auth-gated: must be authenticated. Admin sees all orgs; others see own org.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveAgentHealth } from '@/tree/agents/agent-health-resolver';


export async function GET(): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const summary = await resolveAgentHealth();
    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
