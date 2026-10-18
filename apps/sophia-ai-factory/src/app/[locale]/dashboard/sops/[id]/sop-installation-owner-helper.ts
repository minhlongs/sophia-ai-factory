/**
 * SOP Installation Ownership & Customizations Helper
 *
 * @module app/[locale]/dashboard/sops/[id]/sop-installation-owner-helper
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getInstallation } from '@/seed/sop/sop-repo';
import type { SopCustomizations } from '@/seed/sop/sop-types';
import { getD1 } from '@/seed/db/client';

export async function assertOwner(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' as const };
  const db = await getD1();
  if (!db) return { error: 'Database unavailable' as const };
  const inst = await getInstallation(db, id);
  if (!inst) return { error: 'Installation not found' as const };
  if (inst.user_id !== user.id) return { error: 'Forbidden' as const };
  return { user, db, inst };
}

export function mergeInstallationCustomizations(
  rawCustomizations: string | null | undefined,
  patch: Partial<SopCustomizations>,
): SopCustomizations {
  const existing: SopCustomizations = rawCustomizations
    ? (JSON.parse(rawCustomizations) as SopCustomizations)
    : {};
  return { ...existing, ...patch };
}
