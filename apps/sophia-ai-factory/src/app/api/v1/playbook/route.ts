/**
 * Playbook API — Phase 5c: Auto-Creative Playbook (COMPOUND stage)
 *
 * GET  /api/v1/playbook            — list detected patterns + generated rules
 * POST /api/v1/playbook            — apply a rule (one-click) or toggle autoApply
 * POST /api/v1/playbook/rollback   — manual rollback of a playbook rule
 *
 * Auth: session cookie required (401 if not authenticated).
 * All mutations are server actions wrapped in try/catch — never throw.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { listPatterns, listRules } from '@/forest/patterns';
import { getPlaybookConfig } from '@/land/playbook/playbook-applier';
import {
  QuerySchema,
  executePlaybookRollback,
  handlePlaybookPostAction,
} from './playbook-route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
      autoApplyOnly: searchParams.get('autoApplyOnly') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const [patterns, rules] = await Promise.all([
      listPatterns(user.id),
      listRules(user.id, parsed.data.autoApplyOnly),
    ]);

    return NextResponse.json({ patterns, rules }, { status: 200 });
  } catch (err) {
    logger.error('[GET /api/v1/playbook]', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return await handlePlaybookPostAction(user.id, body);
  } catch (err) {
    logger.error('[POST /api/v1/playbook]', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  // Manual rollback endpoint — mirrors the auto-apply monitor's logic.
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const installationId = String(body.installationId ?? '');
    if (!installationId) {
      return NextResponse.json({ error: 'installationId required' }, { status: 400 });
    }

    const config = await getPlaybookConfig(installationId, user.id);
    if (!config) {
      return NextResponse.json({ error: 'Not a playbook-sourced installation' }, { status: 404 });
    }

    return await executePlaybookRollback(installationId, user.id, config.ruleId);
  } catch (err) {
    logger.error('[PUT /api/v1/playbook/rollback]', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
