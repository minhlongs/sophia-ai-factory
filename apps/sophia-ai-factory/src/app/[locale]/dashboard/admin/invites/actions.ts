'use server';

import { revalidatePath } from 'next/cache';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { createBetaInvite, revokeInvite } from '@/land/sop-marketplace/beta-invites';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

export async function createInviteAction(formData: FormData): Promise<{ error?: string }> {
  const user = await requireMasterTier();
  const db = getD1();
  if (!db) return { error: 'Database unavailable' };

  const email = (formData.get('email') as string | null)?.trim() || undefined;
  const maxUsesRaw = formData.get('maxUses') as string | null;
  const expiresAtRaw = formData.get('expiresAt') as string | null;

  const maxUses = maxUsesRaw ? parseInt(maxUsesRaw, 10) : 1;
  if (isNaN(maxUses) || maxUses < 1) {
    return { error: 'Max uses must be a positive integer' };
  }

  let expiresAt: number | undefined;
  if (expiresAtRaw) {
    const ms = new Date(expiresAtRaw).getTime();
    if (isNaN(ms)) return { error: 'Invalid expiry date' };
    expiresAt = ms;
  }

  try {
    await createBetaInvite(db, {
      email,
      maxUses,
      expiresAt,
      createdBy: user.id,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create invite' };
  }

  revalidatePath('/dashboard/admin/invites');
  return {};
}

export async function revokeInviteAction(id: string): Promise<{ error?: string }> {
  await requireMasterTier();
  const db = getD1();
  if (!db) return { error: 'Database unavailable' };

  try {
    await revokeInvite(db, id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to revoke invite' };
  }

  revalidatePath('/dashboard/admin/invites');
  return {};
}
