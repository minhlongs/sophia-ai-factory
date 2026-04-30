/**
 * POST /api/videos/generate
 *
 * Auth: session cookie (Better Auth)
 * Body: { prompt: string, tier?: string }
 * Response: { jobId: string, status: 'queued' }
 *
 * Guards: 401 unauthenticated, 429 quota exceeded
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';
import { createVideoJob } from '@/lib/video/video-job-pipeline';
import { logger } from '@/lib/utils/logger-utility';
import { getD1Client } from '@/lib/db/client';

/** Phase 11 will replace with full TIER_CONFIG lookup. */
const TIER_CONFIG = {
  videosPerMonth: 100,
} as const;

const generateBodySchema = z.object({
  prompt: z.string().min(1, 'prompt is required').max(2000),
  tier: z.string().optional().default('free'),
});

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = generateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { prompt, tier } = parsed.data;
    // tenantId = userId in Phase 6; Phase 11 introduces org-scoped tenants
    const tenantId = user.id;

    // Quota check
    const db = await getD1Client();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startEpoch = Math.floor(startOfMonth.getTime() / 1000);

    const { data: countRows } = await db
      .from('video_jobs')
      .select('id')
      .eq('tenant_id', tenantId)
      .gte('created_at', startEpoch);

    const currentCount = (countRows as { id: string }[] | null)?.length ?? 0;
    if (currentCount >= TIER_CONFIG.videosPerMonth) {
      logger.warn('[videos/generate] quota exceeded', { tenantId, currentCount });
      return NextResponse.json(
        { error: `Monthly video limit reached (${TIER_CONFIG.videosPerMonth}). Upgrade your plan.` },
        { status: 429 },
      );
    }

    const result = await createVideoJob({ tenantId, userId: user.id, prompt, tier });

    logger.info('[videos/generate] job created', { requestId, jobId: result.jobId, tenantId });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    logger.error('[videos/generate] unexpected error', err instanceof Error ? err : undefined, {}, requestId);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
