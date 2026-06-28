/**
 * PATCH /api/v1/settings/channels — update channels configuration.
 * Upserts into tenant_settings namespace 'channels' with Zod validation.
 *
 * @module app/api/v1/settings/channels/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { set, getOrDefault } from '@/seed/tenant-settings/registry';
import { validatorFor } from '@/seed/tenant-settings/namespace-validators';
import { SettingsValidationError } from '@/seed/tenant-settings/types';
import { DEFAULT_CHANNELS } from '@/seed/tenant-settings/defaults';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ChannelsPatchSchema = z.object({
  channels: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(100),
        enabled: z.boolean(),
      }),
    )
    .optional(),
  templates: z.record(z.string(), z.object({
    titleTemplate: z.string().optional(),
    captionTemplate: z.string().optional(),
    hashtagsTemplate: z.string().optional(),
    ctaTemplate: z.string().optional(),
  })).optional(),
  preferTemplateOverAI: z.boolean().optional(),
});

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch {
    return null;
  }
}

export const PATCH = withRateLimit(
  async function PATCH(req: NextRequest): Promise<NextResponse> {
    const user = await getCurrentUserFromHeaders(req.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (body === null || body === undefined) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parseResult = ChannelsPatchSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 422 },
      );
    }

    const db = getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      const { templates, preferTemplateOverAI } = parseResult.data;
      const existing = await getOrDefault(db, user.id, 'channels', DEFAULT_CHANNELS);

      const merged: typeof DEFAULT_CHANNELS = {
        ...existing,
        ...(templates !== undefined ? { templates } : {}),
        ...(preferTemplateOverAI !== undefined ? { preferTemplateOverAI } : {}),
      };

      await set(db, user.id, 'channels', merged, (v: unknown) =>
        validatorFor('channels')(v) as typeof DEFAULT_CHANNELS,
      );
      return NextResponse.json({ namespace: 'channels', value: merged });
    } catch (err) {
      if (err instanceof SettingsValidationError) {
        return NextResponse.json(
          { error: 'Validation failed', message: err.message },
          { status: 422 },
        );
      }
      logger.error('[settings/channels] PATCH failed', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  },
  { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } },
);
