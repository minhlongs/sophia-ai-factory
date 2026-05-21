/**
 * Dashboard Billing → Change Tier page.
 * Auth-gated server component. Passes current user tier to ChangeTierClient.
 *
 * @module app/[locale]/dashboard/billing/change-tier/page
 */

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { ChangeTierClient } from '@/components/billing/change-tier-client';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ChangeTierPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const currentTier = await getUserTier(user.id);
  const t = await getTranslations({ locale, namespace: 'dashboard.billing.changeTier' });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-1">{t('pageSubtitle')}</p>
      </div>
      <ChangeTierClient currentTier={currentTier} />
    </div>
  );
}
