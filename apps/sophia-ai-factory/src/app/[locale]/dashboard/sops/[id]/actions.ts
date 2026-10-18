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
import { deleteInstallation, updateCustomizations, updateConfigValues } from '@/seed/sop/sop-repo';
import { generateWebhookSecret } from '@/seed/sop/webhook-hmac';
import { customizationInputSchema } from '@/seed/sop/install-input-schema';
import { runSop } from '@/forest/missions/sop-runner';
import { createRun } from '@/seed/sop/sop-repo-runs';
import { logger } from '@/seed/utils/logger-utility';
import {
  assertOwner,
  mergeInstallationCustomizations,
} from './sop-installation-owner-helper';

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

export async function savePlaybookAction(
  installationId: string,
  playbookMd: string,
): Promise<{ error?: string }> {
  const r = await assertOwner(installationId);
  if ('error' in r) return { error: r.error };

  const parsed = customizationInputSchema.safeParse({ playbookMdOverride: playbookMd });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { db, inst } = r;
  const merged = mergeInstallationCustomizations(inst.customizations, {
    playbook_md_override: parsed.data.playbookMdOverride,
  });

  await updateCustomizations(db, installationId, merged);
  revalidatePath(`/dashboard/sops/${installationId}`);
  return {};
}

export async function regenSecretAction(installationId: string): Promise<{ error?: string; webhookSecret?: string }> {
  const r = await assertOwner(installationId);
  if ('error' in r) return { error: r.error };

  const { db, inst } = r;
  const newSecret = generateWebhookSecret();
  const merged = mergeInstallationCustomizations(inst.customizations, {
    webhookSecret: newSecret,
  });
  await updateCustomizations(db, installationId, merged);

  return { webhookSecret: newSecret };
}

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

export async function deleteInstallAction(installationId: string): Promise<{ error?: string }> {
  const r = await assertOwner(installationId);
  if ('error' in r) return { error: r.error };

  await deleteInstallation(r.db, installationId);
  redirect('/dashboard/sops');
}
