/**
 * POST /api/raas/execute
 *
 * Internal route — runs the PEV cycle for a queued mission.
 * Called asynchronously (fire-and-forget) from mission creation.
 * Protected by x-internal-secret header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runMission } from '@/lib/raas/pev-executor';

export const dynamic = 'force-dynamic';

// CF Workers has 30s CPU limit — long missions use fire-and-forget pattern

export async function POST(request: NextRequest) {
  try {
    // 1. Verify internal secret
    const secret = request.headers.get('x-internal-secret');
    const expected = process.env.INTERNAL_API_SECRET;

    if (!expected || secret !== expected) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Parse body
    const { mission_id } = (await request.json()) as { mission_id?: string };
    if (!mission_id) {
      return NextResponse.json({ error: 'mission_id is required' }, { status: 400 });
    }

    // 3. Run PEV cycle — updates DB at each phase
    await runMission(mission_id);

    return NextResponse.json({ success: true, mission_id });
  } catch (err) {
    console.error('POST /api/raas/execute error:', err);
    return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
  }
}
