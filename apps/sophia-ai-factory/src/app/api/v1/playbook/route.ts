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
import { z } from 'zod';
import { listPatterns, listRules } from '@/forest/patterns';
import { applyPlaybook, toggleAutoApply, getPlaybookConfig } from '@/land/playbook/playbook-applier';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  autoApplyOnly: z.coerce.boolean().default(false),
});

const ApplySchema = z.object({
  ruleId: z.string().min(1),
  templateId: z.string().min(1),
  scheduleCron: z.string().max(128).optional(),
});

const ToggleSchema = z.object({
  installationId: z.string().min(1),
  enabled: z.coerce.boolean(),
});

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

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = (body.action as string) ?? 'apply';

    if (action === 'toggle') {
      const parsed = ToggleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid body', details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        );
      }
      const result = await toggleAutoApply(parsed.data.installationId, parsed.data.enabled);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    // Default: apply a rule to a new SOP installation.
    const parsed = ApplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const rules = await listRules(user.id, undefined);
    const rule = rules.find((r) => r.id === parsed.data.ruleId);
    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    const result = await applyPlaybook(
      rule,
      parsed.data.templateId,
      user.id,
      parsed.data.scheduleCron,
    );

    return NextResponse.json(result, { status: result.success ? 201 : 400 });
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

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const installationId = String(body.installationId ?? '');
    if (!installationId) {
      return NextResponse.json({ error: 'installationId required' }, { status: 400 });
    }

    const config = await getPlaybookConfig(installationId);
    if (!config) {
      return NextResponse.json({ error: 'Not a playbook-sourced installation' }, { status: 404 });
    }

    const db = (await import('@/seed/db/client')).createServerClient();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    await db
      .prepare(
        `UPDATE user_sop_installations
            SET config_values = json_set(config_values, '$.autoApply', 0)
          WHERE id = ?1`,
      )
      .bind(installationId)
      .run();

    if (config.ruleId) {
      try {
        await db
          .prepare(`UPDATE playbook_rules SET rollback_count = rollback_count + 1 WHERE id = ?1`)
          .bind(config.ruleId)
          .run();
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ success: true, installationId }, { status: 200 });
  } catch (err) {
    logger.error('[PUT /api/v1/playbook/rollback]', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}