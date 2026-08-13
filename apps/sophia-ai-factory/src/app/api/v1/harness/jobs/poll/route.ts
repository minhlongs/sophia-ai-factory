import { NextRequest, NextResponse } from 'next/server';
import { getD1Raw } from '@/seed/db/client';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';

export const runtime = 'edge';

function verifyHarnessAuth(req: NextRequest): boolean {
  const harnessSecret = process.env.HARNESS_SECRET || process.env.CRON_SECRET || 'dev-harness-secret';
  const headerSecret = req.headers.get('x-harness-secret') || req.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (process.env.NODE_ENV === 'development' && !headerSecret) {
    return true;
  }
  
  return headerSecret === harnessSecret;
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyHarnessAuth(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Record daemon's heartbeat
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const cfCtx = await getCloudflareContext();
      const env = cfCtx.env as Record<string, unknown>;
      const kv = env.EXPERIMENT_KV as {
        put(key: string, value: string): Promise<void>;
      } | undefined;
      if (kv) {
        await kv.put('harness:daemon_last_poll', new Date().toISOString());
      } else {
        logger.warn('EXPERIMENT_KV binding not found in Cloudflare context');
      }
    } catch (err) {
      logger.warn('Gracefully handled error writing daemon heartbeat to EXPERIMENT_KV:', toError(err));
    }

    const db = await getD1Raw();

    // Query oldest pending job
    const pendingJob = await db.prepare(
      "SELECT id, status, triggered_by FROM harness_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
    )
    .first<{ id: string; status: string; triggered_by: string }>();

    if (!pendingJob) {
      return NextResponse.json({ success: true, job: null });
    }

    // Set job to processing status
    await db.prepare(
      "UPDATE harness_jobs SET status = 'processing', updated_at = datetime('now') WHERE id = ?"
    )
    .bind(pendingJob.id)
    .run();

    return NextResponse.json({
      success: true,
      job: {
        id: pendingJob.id,
        status: 'processing',
        triggered_by: pendingJob.triggered_by,
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: toError(e).message }, { status: 500 });
  }
}
