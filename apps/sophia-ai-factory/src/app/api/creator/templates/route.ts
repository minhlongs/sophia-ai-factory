/**
 * API Route: /api/creator/templates
 *
 * GET: List templates for authenticated creator
 * POST: Submit new video template for review
 *
 * @module app/api/creator/templates/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import {
  listCreatorTemplates,
  createCreatorTemplate,
} from '@/land/creator/creator-studio-service';
import type { TemplateStatus } from '@/seed/types/creator-marketplace';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const db = await getD1();
  if (!db) {
    return NextResponse.json({ error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status') as TemplateStatus | null;
  const limitParam = parseInt(searchParams.get('limit') ?? '20', 10);
  const offsetParam = parseInt(searchParams.get('offset') ?? '0', 10);

  try {
    const res = await listCreatorTemplates(db, user.id, {
      status: statusParam ?? undefined,
      limit: limitParam,
      offset: offsetParam,
    });

    return NextResponse.json({ templates: res.items, total: res.total });
  } catch (err) {
    logger.error('Failed to list creator templates via API', { userId: user.id, error: String(err) });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const db = await getD1();
  if (!db) {
    return NextResponse.json({ error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const tenantId = (body.tenantId as string) || (user as { tenantId?: string }).tenantId || 'default';

    const res = await createCreatorTemplate(db, user.id, tenantId, body as never);

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ template: res.template }, { status: 201 });
  } catch (err) {
    logger.error('Failed to create creator template via API', { userId: user.id, error: String(err) });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}
