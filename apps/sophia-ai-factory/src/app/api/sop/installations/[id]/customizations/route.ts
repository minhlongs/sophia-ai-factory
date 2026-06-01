/**
 * PATCH /api/sop/installations/[id]/customizations — save playbook override.
 *
 * Body: { playbookMdOverride?: string, vars?: Record<string, unknown> }
 * Validates length ≤32KB. Merges with existing customizations.
 * Auth + ownership check required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getInstallation, updateCustomizations } from '@/tree/sop/sop-repo';
import { customizationInputSchema } from '@/tree/sop/install-input-schema';
import { getSopD1 } from '@/tree/sop/d1';
import type { SopCustomizations } from '@/tree/sop/sop-types';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getSopD1();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const inst = await getInstallation(db, id);
  if (!inst) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (inst.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = customizationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
  }

  // Merge with existing customizations (preserve webhookSecret)
  const existing: SopCustomizations = inst.customizations
    ? (JSON.parse(inst.customizations) as SopCustomizations)
    : {};

  const merged: SopCustomizations = {
    ...existing,
    playbook_md_override: parsed.data.playbookMdOverride,
    vars: parsed.data.vars as Record<string, string> | undefined,
  };

  await updateCustomizations(db, id, merged);
  return NextResponse.json({ ok: true });
}
