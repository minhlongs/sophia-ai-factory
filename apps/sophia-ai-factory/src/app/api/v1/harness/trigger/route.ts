import { NextRequest, NextResponse } from 'next/server';
import { getD1Raw } from '@/seed/db/client';
import { toError } from '@/seed/utils/to-error';

export const runtime = 'edge';

function verifyHarnessAuth(req: NextRequest): boolean {
  const harnessSecret = process.env.HARNESS_SECRET || process.env.CRON_SECRET || 'dev-harness-secret';
  const headerSecret = req.headers.get('x-harness-secret') || req.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (process.env.NODE_ENV === 'development' && !headerSecret) {
    return true;
  }
  
  return headerSecret === harnessSecret;
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyHarnessAuth(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let body: { triggered_by?: string } = { triggered_by: 'web' };
    try {
      body = await request.json();
    } catch {
      // Allow empty body
    }

    const triggeredBy = body.triggered_by || 'web';
    if (!['web', 'telegram', 'scheduler'].includes(triggeredBy)) {
      return NextResponse.json({ success: false, error: 'Invalid triggered_by value' }, { status: 400 });
    }

    const db = await getD1Raw();
    const jobId = crypto.randomUUID();

    await db.prepare(
      "INSERT INTO harness_jobs (id, status, triggered_by, created_at, updated_at) VALUES (?, 'pending', ?, datetime('now'), datetime('now'))"
    )
    .bind(jobId, triggeredBy)
    .run();

    return NextResponse.json({ success: true, id: jobId, status: 'pending' });
  } catch (e) {
    return NextResponse.json({ success: false, error: toError(e).message }, { status: 500 });
  }
}
