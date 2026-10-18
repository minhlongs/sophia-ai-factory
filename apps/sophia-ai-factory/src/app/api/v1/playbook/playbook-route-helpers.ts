/**
 * Playbook API Route Helpers
 *
 * Validation schemas and mutation helpers for /api/v1/playbook.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listRules } from '@/forest/patterns';
import { applyPlaybook, toggleAutoApply } from '@/land/playbook/playbook-applier';

export const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  autoApplyOnly: z.coerce.boolean().default(false),
});

export const ApplySchema = z.object({
  ruleId: z.string().min(1),
  templateId: z.string().min(1),
  scheduleCron: z.string().max(128).optional(),
});

export const ToggleSchema = z.object({
  installationId: z.string().min(1),
  enabled: z.coerce.boolean(),
});

export async function handlePlaybookPostAction(
  userId: string,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const action = (body.action as string) ?? 'apply';

  if (action === 'toggle') {
    const parsed = ToggleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const result = await toggleAutoApply(parsed.data.installationId, parsed.data.enabled, userId);
    const status = result.success ? 200 : result.code === 'NOT_FOUND' ? 404 : 400;
    return NextResponse.json(result, { status });
  }

  const parsed = ApplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const rules = await listRules(userId, undefined);
  const rule = rules.find((r) => r.id === parsed.data.ruleId);
  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  const result = await applyPlaybook(
    rule,
    parsed.data.templateId,
    userId,
    parsed.data.scheduleCron,
  );

  const status = result.success
    ? 201
    : result.code === 'PAYMENT_REQUIRED'
      ? 402
      : 400;
  return NextResponse.json(result, { status });
}

export async function executePlaybookRollback(
  installationId: string,
  userId: string,
  ruleId?: string | null,
): Promise<NextResponse> {
  const db = (await import('@/seed/db/client')).createServerClient();
  if (!db) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }

  const result = await db
    .prepare(
      `UPDATE user_sop_installations
          SET config_values = json_set(config_values, '$.autoApply', 0)
        WHERE id = ?1 AND user_id = ?2`,
    )
    .bind(installationId, userId)
    .run();

  if (typeof result.meta?.changes === 'number' && result.meta.changes === 0) {
    return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
  }

  if (ruleId) {
    try {
      await db
        .prepare(`UPDATE playbook_rules SET rollback_count = rollback_count + 1 WHERE id = ?1`)
        .bind(ruleId)
        .run();
    } catch {
      /* non-fatal */
    }
  }

  return NextResponse.json({ success: true, installationId }, { status: 200 });
}
