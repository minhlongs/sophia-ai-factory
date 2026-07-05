/**
 * /dashboard/admin/branding — White-label branding configuration (MASTER-tier only).
 *
 * Server Component. Loads organizations with existing branding data and
 * delegates the interactive form to the BrandingForm client component.
 *
 * @module app/[locale]/dashboard/admin/branding/page
 */

import { Palette } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { listOrgs } from '@/land/admin/org-manager';
import type { OrgRow } from '@/land/admin/org-manager';
import { BrandingForm } from './branding-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function BrandingPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  await requireMasterTier();
  const t = await getTranslations({ locale, namespace: 'admin.branding' });

  const orgsResult = await listOrgs();
  let orgs: OrgRow[] = [];
  let loadError: string | null = null;

  if (!orgsResult.ok) {
    loadError = orgsResult.error.message;
  } else {
    orgs = orgsResult.value;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <Palette className="w-6 h-6 text-primary-400 mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('pageSubtitle')}
          </p>
        </div>
      </header>

      {loadError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {loadError}
        </div>
      )}

      <BrandingForm
        orgs={orgs}
      />
    </div>
  );
}
