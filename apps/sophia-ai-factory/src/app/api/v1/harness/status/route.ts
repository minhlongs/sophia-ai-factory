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

export async function GET(request: NextRequest) {
  try {
    if (!verifyHarnessAuth(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let lastPoll: string | null = null;
    let daemonStatus: 'ONLINE' | 'OFFLINE' = 'OFFLINE';

    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const cfCtx = await getCloudflareContext();
      const env = cfCtx.env as Record<string, unknown>;
      const kv = env.EXPERIMENT_KV as {
        get(key: string): Promise<string | null>;
      } | undefined;
      if (kv) {
        lastPoll = await kv.get('harness:daemon_last_poll');
        if (lastPoll) {
          const lastPollTime = new Date(lastPoll).getTime();
          const nowTime = new Date().getTime();
          if (!isNaN(lastPollTime) && Math.abs(nowTime - lastPollTime) <= 30000) {
            daemonStatus = 'ONLINE';
          }
        }
      }
    } catch (err) {
      console.warn('Gracefully handled error reading daemon heartbeat from EXPERIMENT_KV:', err);
    }

    const db = await getD1Raw();

    // Query latest job
    const latestJob = await db.prepare(
      "SELECT id, status, triggered_by, created_at, updated_at FROM harness_jobs ORDER BY created_at DESC LIMIT 1"
    )
    .first<{ id: string; status: string; triggered_by: string; created_at: string; updated_at: string }>();

    let results: {
      test_name: string;
      status: string;
      duration_ms: number;
      error_message: string | null;
      metadata: string | null;
    }[] = [];

    if (latestJob) {
      const resultsQuery = await db.prepare(
        "SELECT test_name, status, duration_ms, error_message, metadata FROM harness_results WHERE job_id = ?"
      )
      .bind(latestJob.id)
      .all<{
        test_name: string;
        status: string;
        duration_ms: number;
        error_message: string | null;
        metadata: string | null;
      }>();
      
      results = resultsQuery.results || [];
    }

    return NextResponse.json({
      success: true,
      daemon: {
        status: daemonStatus,
        last_poll: lastPoll
      },
      latestJob: latestJob ? {
        id: latestJob.id,
        status: latestJob.status,
        triggered_by: latestJob.triggered_by,
        created_at: latestJob.created_at,
        updated_at: latestJob.updated_at,
        results: results
      } : null
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: toError(e).message }, { status: 500 });
  }
}
