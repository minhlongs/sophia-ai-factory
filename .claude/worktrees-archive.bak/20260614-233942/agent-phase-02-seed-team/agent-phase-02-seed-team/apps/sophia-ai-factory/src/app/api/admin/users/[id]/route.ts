/**
 * PATCH /api/admin/users/[id] — admin tier/role promotion.
 * Updates the user's most-recent subscription plan and/or users.role.
 *
 * Auth: requireAdmin (RBAC). Returns 401/403 for non-admins.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/seed/auth/require-admin';
import { getD1Client } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  tier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']).optional(),
  role: z.enum(['user', 'admin']).optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'User id required' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const db = await getD1Client();
  const now = Math.floor(Date.now() / 1000);

  try {
    if (parsed.data.tier) {
      // Migration 0001 stores `plan` lowercase; later migration added uppercase
      // `tier` column read by getUserTier(). Keep BOTH in sync to prevent
      // stale-tier reads after admin promotion.
      const plan = parsed.data.tier.toLowerCase();
      const tier = parsed.data.tier;
      const { data: existing } = await db
        .from('subscriptions')
        .select('id')
        .eq('user_id', id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        await db
          .from('subscriptions')
          .update({ plan, tier, status: 'active', updated_at: now })
          .eq('id', (existing as { id: string }).id);
      } else {
        await db.from('subscriptions').insert({
          id: crypto.randomUUID(),
          user_id: id,
          plan,
          tier,
          status: 'active',
          created_at: now,
          updated_at: now,
        });
      }
    }

    if (parsed.data.role) {
      await db.from('users').update({ role: parsed.data.role }).eq('id', id);
    }

    logger.info('[admin/users PATCH] User updated', { userId: id, ...parsed.data });
    return NextResponse.json({ success: true, userId: id, applied: parsed.data });
  } catch (err) {
    logger.error('[admin/users PATCH] Failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
