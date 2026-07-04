'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { hasCreatorAccess } from '@/land/sop-marketplace';
import { getTranslations } from 'next-intl/server';
import { getD1 } from '@/seed/db/client';


export async function createSopAction(formData: FormData): Promise<{ error?: string; templateId?: string }> {
  const t = await getTranslations('sop.creator.actions');
  const user = await getCurrentUser();
  if (!user) return { error: t('unauthorized') };

  const db = getD1();
  if (!db) return { error: t('dbUnavailable') };

  const hasAccess = await hasCreatorAccess(db, user.id);
  if (!hasAccess) return { error: t('creatorAccessRequired') };

  const nameEn = formData.get('name_en') as string;
  const nameVi = formData.get('name_vi') as string;
  const descriptionEn = (formData.get('description_en') as string) || '';
  const descriptionVi = (formData.get('description_vi') as string) || '';
  const category = formData.get('category') as string;
  const playbookMd = formData.get('playbook_md') as string;
  const agentsYaml = formData.get('agents_yaml') as string;
  const configSchema = (formData.get('config_schema') as string) || null;
  const priceUsd = Number(formData.get('price_usd') || '0');
  const setupTime = Number(formData.get('setup_time_minutes') || '30');
  const creditsPerRun = Number(formData.get('credits_per_run') || '10');

  if (!nameEn || !nameVi || !category || !playbookMd || !agentsYaml) {
    return { error: t('requiredFieldsMissing') };
  }
  if (priceUsd < 5 || priceUsd > 999) {
    return { error: t('priceRange') };
  }

  const slug = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const { createTemplate, createListing } = await import('@/tree/sop/sop-repo');

  const template = await createTemplate(db, {
    slug, nameVi, nameEn, descriptionVi, descriptionEn, category,
    agentsYaml, playbookMd, configSchema: configSchema || undefined,
    creditsPerRun, setupTimeMinutes: setupTime, authorUserId: user.id,
  });

  await createListing(db, {
    templateId: template.id,
    priceCents: Math.round(priceUsd * 100),
  });

  redirect('/dashboard/sop-creator');
}

export async function submitForReviewAction(templateId: string): Promise<{ error?: string }> {
  const t = await getTranslations('sop.creator.actions');
  const user = await getCurrentUser();
  if (!user) return { error: t('unauthorized') };

  const db = getD1();
  if (!db) return { error: t('dbUnavailable') };

  const { getTemplateById, getListingByTemplateId, updateListingStatus } = await import('@/tree/sop/sop-repo');

  const template = await getTemplateById(db, templateId);
  if (!template || template.author_user_id !== user.id) return { error: t('notYourTemplate') };

  await db.prepare(`UPDATE sop_templates SET status = 'pending_review', updated_at = ?1 WHERE id = ?2`)
    .bind(Date.now(), templateId).run();

  const listing = await getListingByTemplateId(db, templateId);
  if (listing) {
    await updateListingStatus(db, listing.id, 'pending_review');
  }

  return {};
}
