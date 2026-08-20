/**
 * POST /api/publish/retry
 *
 * Retries a failed WhatsApp publish job.
 * Auth: session cookie via getCurrentUser()
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';

const retrySchema = z.object({ jobId: z.string().min(1, 'jobId is required') });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const db = await getD1();
  if (!db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const { jobId } = retrySchema.parse(await request.json());

    // Verify job belongs to caller and is failed
    const job = await db
      .prepare(
        `SELECT id, status, retry_count FROM publishing_jobs
         WHERE id = ?1 AND tenant_id = ?2 AND provider = 'whatsapp' LIMIT 1`,
      )
      .bind(jobId, user.id)
      .first<{ id: string; status: string; retry_count: number }>();

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'failed') {
      return NextResponse.json({ error: 'Only failed jobs can be retried' }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    const newRetryCount = job.retry_count + 1;

    await db
      .prepare(
        `UPDATE publishing_jobs SET status = 'scheduled', retry_count = ?, scheduled_at = ?, error_message = NULL
         WHERE id = ?1`,
      )
      .bind(newRetryCount, now, jobId)
      .run();

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Retry failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}