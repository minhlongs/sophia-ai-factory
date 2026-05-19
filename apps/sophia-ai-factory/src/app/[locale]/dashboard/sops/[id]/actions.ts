'use server';

/**
 * SOP Installation Detail Server Actions
 *
 * runNowAction        — trigger manual SOP run
 * savePlaybookAction  — update playbook_md_override
 * regenSecretAction   — rotate HMAC secret (returns new secret plaintext once)
 * deleteInstallAction — hard-delete installation
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getInstallation, deleteInstallation, updateCustomizations, updateConfigValues } from '@/lib/sop/sop-repo';
import { generateWebhookSecret } from '@/lib/sop/webhook-hmac';
import { customizationInputSchema } from '@/lib/sop/install-input-schema';
import { runSop } from '@/lib/sop/executor/sop-runner';
import { createRun } from '@/lib/sop/sop-repo-runs';
import { logger } from '@/seed/utils/logger-utility';
import type { SopCustomizations } from '@/lib/sop/sop-types';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

async function assertOwner(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' as const };
  const db = getD1();
  if (!db) return { error: 'Database unavailable' as const };
  const inst = await getInstallation(db, id);
  if (!inst) return { error: 'Installation not found' as const };
  if (inst.user_id !== user.id) return { error: 'Forbidden' as const };
  return { user, db, inst };
}

// ---------------------------------------------------------------------------
// Run now
// ---------------------------------------------------------------------------
export async function runNowAction(installationId: string): Promise<{ error?: string }> {
  const r = await assertOwner(installationId);
  if ('error' in r) return { error: r.error };

  const { db, inst, user } = r;
  if (!inst.enabled) return { error: 'Installation is disabled' };

  const run = await createRun(db, installationId, 'manual');

  const runCtx = {
    installationId,
    runId: run.id,
    userId: user.id,
    trigger: 'manual' as const,
    triggerPayload: {},
  };

  void runSop(db, runCtx).catch(err => {
    logger.error('[runNowAction] error', err instanceof Error ? err : new Error(String(err)), { installationId });
  });

  revalidatePath(`/dashboard/sops/${installationId}`);
  return {};
}

// ---------------------------------------------------------------------------
// Save playbook
// ---------------------------------------------------------------------------
export async function savePlaybookAction(
  installationId: string,
  playbookMd: string,
): Promise<{ error?: string }> {
  const r = await assertOwner(installationId);
  if ('error' in r) return { error: r.error };

  const parsed = customizationInputSchema.safeParse({ playbookMdOverride: playbookMd });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { db, inst } = r;
  const existing: SopCustomizations = inst.customizations
    ? (JSON.parse(inst.customizations) as SopCustomizations)
    : {};

  const merged: SopCustomizations = {
    ...existing,
    playbook_md_override: parsed.data.playbookMdOverride,
  };

  await updateCustomizations(db, installationId, merged);
  revalidatePath(`/dashboard/sops/${installationId}`);
  return {};
}

// ---------------------------------------------------------------------------
// Regenerate secret
// ---------------------------------------------------------------------------
export async function regenSecretAction(installationId: string): Promise<{ error?: string; webhookSecret?: string }> {
  const r = await assertOwner(installationId);
  if ('error' in r) return { error: r.error };

  const { db, inst } = r;
  const newSecret = generateWebhookSecret();

  const existing: SopCustomizations = inst.customizations
    ? (JSON.parse(inst.customizations) as SopCustomizations)
    : {};

  const merged: SopCustomizations = { ...existing, webhookSecret: newSecret };
  await updateCustomizations(db, installationId, merged);

  return { webhookSecret: newSecret };
}

// ---------------------------------------------------------------------------
// Save config values (no-code form on edit tab)
// ---------------------------------------------------------------------------
export async function saveConfigAction(
  installationId: string,
  configValues: Record<string, unknown>,
): Promise<{ error?: string }> {
  const r = await assertOwner(installationId);
  if ('error' in r) return { error: r.error };

  await updateConfigValues(r.db, installationId, configValues);
  revalidatePath(`/dashboard/sops/${installationId}`);
  return {};
}

// ---------------------------------------------------------------------------
// Delete installation
// ---------------------------------------------------------------------------
export async function deleteInstallAction(installationId: string): Promise<{ error?: string }> {
  const r = await assertOwner(installationId);
  if ('error' in r) return { error: r.error };

  await deleteInstallation(r.db, installationId);
  redirect('/dashboard/sops');
}
