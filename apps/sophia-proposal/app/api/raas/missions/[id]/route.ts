/**
 * GET /api/raas/missions/[id]
 *
 * Returns mission status, result, and execution_log for polling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getAuthContext } from '@/lib/raas/auth-context';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId } = auth;
    const serverClient = createServerClient();

    const { data: mission, error } = await serverClient
      .from('missions')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    return NextResponse.json({ mission });
  } catch (err) {
    console.error(`GET /api/raas/missions/${id} error:`, err);
    return NextResponse.json({ error: 'Failed to fetch mission' }, { status: 500 });
  }
}
