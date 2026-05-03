/**
 * POST /api/videos/generate
 *
 * Auth: session cookie (Better Auth)
 * Body: { prompt: string, tier?: string }
 * Response: { jobId: string, status: 'queued' }
 *
 * P0.2: Server-side tier quota enforced via checkTierQuota.
 * Returns 429 with retry-after metadata when limit exceeded.
 * Guards: 401 unauthenticated, 402 BASIC tier (no video gen), 429 quota exceeded
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';
import { createVideoJob } from '@/lib/video/video-job-pipeline';
import { logger } from '@/lib/utils/logger-utility';
import { checkTierQuota } from '@/lib/auth/enforce-tier-quota';
import { getUserTier } from '@/lib/db/get-user-tier';

const PREMIUM_TIERS = new Set(['PREMIUM', 'ENTERPRISE', 'MASTER']);

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
    const tenantId = user.id;

    // P0.2: Gate BASIC tier — video gen requires PREMIUM+
    const userTier = await getUserTier(user.id);
    if (!PREMIUM_TIERS.has(userTier)) {
      return NextResponse.json(
        {
          error: 'Video generation requires PREMIUM tier or higher.',
          upgrade: '/pricing',
        },
        { status: 402 },
      );
    }

    // P0.2: Server-side monthly quota check
    const quota = await checkTierQuota(user.id);
    if (!quota.allowed) {
      logger.warn('[videos/generate] quota exceeded', {
        tenantId,
        used: quota.used,
        limit: quota.limit,
        tier: userTier,
      });
      return NextResponse.json(
        {
          error: quota.reason ?? 'Monthly video limit reached. Upgrade your plan.',
          used: quota.used,
          limit: quota.limit,
          resetsAt: quota.resetsAt,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(secondsUntilReset(quota.resetsAt)) },
        },
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

function secondsUntilReset(resetsAt: string): number {
  const delta = Math.max(0, new Date(resetsAt).getTime() - Date.now())
  return Math.ceil(delta / 1000)
}
