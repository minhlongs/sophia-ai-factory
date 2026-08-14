/**
 * GET  /api/v1/sops              — list official SOP templates (read-only marketplace)
 * POST /api/v1/sops               — install template by slug (returns installation)
 *
 * Auth: Better Auth session via getCurrentUser().
 * Rate-limit: tier-aware via withRateLimit (POST is heaviest — creates installation row).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listOfficialTemplates, getTemplateBySlug, createInstallation } from '@/tree/sop/sop-repo';
import { generateWebhookSecret } from '@/tree/sop/webhook-hmac';
import { getSopD1 } from '@/tree/sop/d1';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

export const InstallSchema = z.object({
  slug: z.string().min(1).max(100),
  scheduleCron: z.string().max(100).optional(),
  enabled: z.boolean().optional().default(true),
  configValues: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(_request: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof getCurrentUser>> | null = null;
  try {
    user = await getCurrentUser();
  } catch {
    /* unauth */
  }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getSopD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const templates = await listOfficialTemplates(db);
    return NextResponse.json({ templates });
  } catch (err) {
    logger.error('[GET /api/v1/sops] List failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export const POST = withRateLimit(async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getSopD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = InstallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
  }

  const template = await getTemplateBySlug(db, parsed.data.slug);
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  try {
    const installation = await createInstallation(db, {
      userId: user.id,
      templateId: template.id,
      scheduleCron: parsed.data.scheduleCron,
      customizations: { webhookSecret: generateWebhookSecret() },
      configValues: parsed.data.configValues,
    });
    return NextResponse.json({ installation }, { status: 201 });
  } catch (err) {
    logger.error('[POST /api/v1/sops] Install failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Install failed' }, { status: 500 });
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 20 } });
