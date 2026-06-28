/**
 * GET /api/v1/factory/url-to-revenue/[jobId]
 *
 * Get status of a URL-to-revenue job.
 * Auth: getCurrentUser() — tenant isolation enforced.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getJobStatus } from '@/land/factory/url-to-revenue';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;
  return withRateLimit(async (r: NextRequest) => {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    try {
      const result = await getJobStatus(user.id, jobId);
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('not found')) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      logger.error('[url-to-revenue] Status fetch failed', err instanceof Error ? err : new Error(message), {
        jobId,
        userId: user.id,
      });
      return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } })(_request);
}
