'use server';

/**
 * SOP Review Actions — approve or reject community SOP submissions.
 *
 * @module app/[locale]/dashboard/admin/sop-reviews/actions
 */

import { revalidatePath } from 'next/cache';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { getD1 } from '@/seed/db/client';

export async function approveSopAction(templateId: string): Promise<{ error?: string }> {
  await requireMasterTier();

  const db = getD1();
  if (!db) return { error: 'Database unavailable' };

  const result = await db
    .prepare(`UPDATE sop_templates SET status = 'published', updated_at = ?1 WHERE id = ?2 AND status = 'pending_review'`)
    .bind(Date.now(), templateId)
    .run();

  if (result.meta.changes === 0) {
    return { error: 'SOP not found or not in pending_review status' };
  }

  revalidatePath('/dashboard/admin/sop-reviews');
  return {};
}

export async function rejectSopAction(templateId: string): Promise<{ error?: string }> {
  await requireMasterTier();

  const db = getD1();
  if (!db) return { error: 'Database unavailable' };

  const result = await db
    .prepare(`UPDATE sop_templates SET status = 'draft', updated_at = ?1 WHERE id = ?2 AND status = 'pending_review'`)
    .bind(Date.now(), templateId)
    .run();

  if (result.meta.changes === 0) {
    return { error: 'SOP not found or not in pending_review status' };
  }

  revalidatePath('/dashboard/admin/sop-reviews');
  return {};
}
