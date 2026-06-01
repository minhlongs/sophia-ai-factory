'use server';

/**
 * SOP Marketplace Server Actions
 *
 * installSopAction   — create user_sop_installations row + generate webhook secret
 * toggleSopAction    — enable/disable an installation
 * deleteSopAction    — hard-delete an installation (ownership enforced)
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getTemplateBySlug, createInstallation, setEnabled, deleteInstallation, getInstallation } from '@/tree/sop/sop-repo';
import { generateWebhookSecret } from '@/tree/sop/webhook-hmac';
import { installInputSchema } from '@/tree/sop/install-input-schema';
import type { SopCustomizations } from '@/tree/sop/sop-types';

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

  // Parse configValues from form — may be absent for templates without config_schema
  let configValues: Record<string, unknown> | undefined;
  const configValuesRaw = formData.get('configValues');
  if (configValuesRaw && typeof configValuesRaw === 'string') {
    try {
      configValues = JSON.parse(configValuesRaw) as Record<string, unknown>;
    } catch { configValues = undefined; }
  }

  // Parse optional Markdown override from advanced section
  const customizationsRaw = formData.get('customizations');
  const playbookMdOverride = customizationsRaw && typeof customizationsRaw === 'string' && customizationsRaw.trim()
    ? customizationsRaw.trim()
    : undefined;

  const db = getD1();
  if (!db) return { error: 'Database unavailable' };

  const template = await getTemplateBySlug(db, slug);
  if (!template) return { error: 'Template not found' };

  const webhookSecret = generateWebhookSecret();
  const customizations: SopCustomizations = {
    webhookSecret,
    ...(playbookMdOverride ? { playbook_md_override: playbookMdOverride } : {}),
  };

  const installation = await createInstallation(db, {
    userId: user.id,
    templateId: template.id,
    scheduleCron: scheduleCron ?? undefined,
    customizations,
    configValues,
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

// ---------------------------------------------------------------------------
// Purchase community SOP (MVP: mark paid immediately — NOWPayments in Phase 4)
// ---------------------------------------------------------------------------
export async function purchaseSopAction(
  templateId: string,
): Promise<{ error?: string; checkoutUrl?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const db = getD1();
  if (!db) return { error: 'Database unavailable' };

  const {
    getUserLicense,
    getListingByTemplateId,
    createLicense,
    markLicensePaid,
    incrementSales,
    getTemplateById,
  } = await import('@/tree/sop/sop-repo');
  const { recordSopSaleCommission } = await import('@/land/sop-marketplace');

  // Idempotency: bail if already purchased
  const existingLicense = await getUserLicense(db, user.id, templateId);
  if (existingLicense) return { error: 'Already purchased' };

  const listing = await getListingByTemplateId(db, templateId);
  if (!listing || listing.status !== 'published') return { error: 'Listing not available' };

  // Create pending license row
  const license = await createLicense(db, {
    userId: user.id,
    templateId,
    listingId: listing.id,
    priceCents: listing.price_cents,
  });

  const paymentId = `mvp_${license.id}`;

  // Mark paid + update listing counters
  await markLicensePaid(db, license.id, paymentId);
  await incrementSales(db, listing.id, listing.price_cents);

  // Record creator commission (70/30 split, 14-day hold)
  const template = await getTemplateById(db, templateId);
  if (template?.author_user_id) {
    await recordSopSaleCommission(db, {
      creatorId: template.author_user_id,
      listingId: listing.id,
      templateId,
      licenseId: license.id,
      priceCents: listing.price_cents,
      paymentId,
    });
  }

  return {};
}

// ---------------------------------------------------------------------------
// Generate affiliate link for a SOP template
// ---------------------------------------------------------------------------
export async function generateSopLinkAction(templateId: string): Promise<{ error?: string; code?: string; url?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const db = getD1();
  if (!db) return { error: 'Database unavailable' };

  const { generateSopAffiliateLink, buildSopReferralUrl } = await import('@/land/sop-marketplace');
  const result = await generateSopAffiliateLink(db, user.id, templateId);

  return { code: result.code, url: buildSopReferralUrl(result.code) };
}
