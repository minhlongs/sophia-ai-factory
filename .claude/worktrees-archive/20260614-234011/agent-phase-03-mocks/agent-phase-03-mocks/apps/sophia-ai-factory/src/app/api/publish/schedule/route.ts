/**
 * POST /api/publish/schedule
 *
 * Schedule a video for multi-channel publishing.
 * Auth: Bearer (OpenClaw plugin, scope: publish:write) OR session cookie
 * Body: { videoJobId, channels[], caption, hashtags, productLink?, scheduledAt }
 * Response: { jobIds, quotaBlocked }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserOrOpenClaw, isAuthError } from '@/seed/auth/get-current-user-or-openclaw';
import { schedulePublish } from '@/forest/publishing/scheduler';
import { logger } from '@/seed/utils/logger-utility';

const scheduleBodySchema = z.object({
  videoJobId: z.string().uuid('videoJobId must be a valid UUID'),
  channels: z.array(z.string().min(1)).min(1, 'At least one channel required'),
  caption: z.string().min(1).max(2200),
  hashtags: z.array(z.string()).default([]),
  productLink: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//.test(u), { message: 'productLink must be https:// or http://' })
    .optional(),
  scheduledAt: z.number().int().positive().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await getCurrentUserOrOpenClaw(request, { requiredScope: 'publish:write' });
    if (isAuthError(auth)) return auth.toNextResponse();
    const userId = auth.userId;

    const body = await request.json().catch(() => null);
    const parsed = scheduleBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { videoJobId, channels, caption, hashtags, productLink, scheduledAt } = parsed.data;

    // tenantId = userId (Phase 11 introduces org tenants)
    const tenantId = userId;
    const now = Math.floor(Date.now() / 1000);

    const result = await schedulePublish({
      videoJobId,
      tenantId,
      userId,
      channelIds: channels,
      caption,
      hashtags,
      productLink,
      scheduledAt: scheduledAt ?? now,
    });

    if (result.jobIds.length === 0 && result.quotaBlocked.length > 0) {
      const maxRetryAfter = Math.max(...result.quotaBlocked.map(b => b.retryAfter));
      return NextResponse.json(
        { error: 'Quota exceeded for all channels', quotaBlocked: result.quotaBlocked },
        {
          status: 429,
          headers: { 'Retry-After': String(maxRetryAfter) },
        },
      );
    }

    logger.info('[publish/schedule] Scheduled', { tenantId, jobIds: result.jobIds });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    logger.error('[publish/schedule] Error', err instanceof Error ? err : new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
