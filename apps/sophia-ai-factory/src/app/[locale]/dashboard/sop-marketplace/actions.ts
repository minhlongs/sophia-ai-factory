'use server';

/**
 * SOP Marketplace Server Actions
 *
 * installSopAction   — create user_sop_installations row + generate webhook secret
 * toggleSopAction    — enable/disable an installation
 * deleteSopAction    — hard-delete an installation (ownership enforced)
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/better-auth-session';
import { getTemplateBySlug, createInstallation, setEnabled, deleteInstallation, getInstallation } from '@/lib/sop/sop-repo';
import { generateWebhookSecret } from '@/lib/sop/webhook-hmac';
import { installInputSchema } from '@/lib/sop/install-input-schema';
import type { SopCustomizations } from '@/lib/sop/sop-types';

// ---------------------------------------------------------------------------
// D1 access — mirror pattern from trigger route
// ---------------------------------------------------------------------------
function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------
export async function installSopAction(formData: FormData): Promise<{ error?: string; installationId?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const raw = {
    slug: formData.get('slug'),
    scheduleCron: formData.get('scheduleCron') ?? undefined,
    enabled: formData.get('enabled') !== 'false',
  };

  const parsed = installInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { slug, scheduleCron, enabled } = parsed.data;
  const db = getD1();
  if (!db) return { error: 'Database unavailable' };

  const template = await getTemplateBySlug(db, slug);
  if (!template) return { error: 'Template not found' };

  const webhookSecret = generateWebhookSecret();
  const customizations: SopCustomizations = { webhookSecret };

  const installation = await createInstallation(db, {
    userId: user.id,
    templateId: template.id,
    scheduleCron: scheduleCron ?? undefined,
    customizations,
  });

  if (!enabled) {
    await setEnabled(db, installation.id, false);
  }

  redirect(`/dashboard/sops/${installation.id}`);
}

// ---------------------------------------------------------------------------
// Toggle enabled
// ---------------------------------------------------------------------------
export async function toggleSopAction(installationId: string, enabled: boolean): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const db = getD1();
  if (!db) return { error: 'Database unavailable' };

  const inst = await getInstallation(db, installationId);
  if (!inst) return { error: 'Installation not found' };
  if (inst.user_id !== user.id) return { error: 'Forbidden' };

  await setEnabled(db, installationId, enabled);
  return {};
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
export async function deleteSopAction(installationId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const db = getD1();
  if (!db) return { error: 'Database unavailable' };

  const inst = await getInstallation(db, installationId);
  if (!inst) return { error: 'Installation not found' };
  if (inst.user_id !== user.id) return { error: 'Forbidden' };

  await deleteInstallation(db, installationId);
  redirect('/dashboard/sops');
}
