/**
 * POST /api/v1/factory/url-to-revenue
 *
 * Start a URL-to-revenue job: paste affiliate URL, generate localized video
 * variants, publish, embed tracking link.
 *
 * Auth: getCurrentUser() — tenant-scoped
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { startUrlToRevenue } from '@/lib/factory/url-to-revenue';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

const VALID_CHANNELS = ['youtube', 'tiktok', 'instagram'] as const;

const RequestSchema = z.object({
  url: z.string().url().startsWith('https://'),
  channels: z.array(z.enum(VALID_CHANNELS)).min(1),
  variants: z.number().int().min(1).max(5).optional(),
  locales: z.array(z.string().min(2).max(10)).optional(),
  trackingId: z.string().optional(),
});

// Tight tier-aware rate limit: video gen is expensive (Replicate/HeyGen costs).
// 10/min hard ceiling protects from accidental loops; tier-config can lift higher.
export const POST = withRateLimit(async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await startUrlToRevenue({
      url: parsed.data.url,
      tenantId: user.id,
      channels: parsed.data.channels,
      variants: parsed.data.variants,
      locales: parsed.data.locales,
      trackingId: parsed.data.trackingId,
    });

    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    logger.error('[url-to-revenue] Start failed', err instanceof Error ? err : new Error(String(err)), {
      userId: user.id,
    });
    return NextResponse.json({ error: 'Failed to start job' }, { status: 500 });
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 10 } });
