/**
 * CEO Agent Campaigns — /dashboard/ceo-agent/campaigns
 *
 * Server Component: resolves auth/tier via loadCeoAgentPage, fetches page-scoped
 * i18n labels, then renders the hydrated `CampaignsClient` shell.
 *
 * Access contract:
 *  - BASIC tier is redirected to root — the tier-gate gate rendered by CeoAgentShell.
 *  - All other tiers see listings. Creation is UI-blocked according to tier.
 */

import { loadCeoAgentPage } from '@/land/ceo-agent/load-ceo-agent-page';
import { listCampaignsAction } from './actions';
import { getTranslations } from 'next-intl/server';
import { CampaignsClient } from './campaigns-client';

export const dynamic = 'force-dynamic';

export interface CampaignsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CampaignsPageProps) {
  const { locale } = await params;
  const t = await getTranslations('dashboard.ceoAgent');
  return {
    title: `${t('campaignsTitle')} | Sophia AI`,
    description: t('campaignsDesc'),
  };
}

export default async function CampaignsPage({ params }: CampaignsPageProps) {
  const initial = await loadCeoAgentPage({ params });
  const hasAccess = initial.userTier !== 'BASIC';

  if (!hasAccess) {
    return null;
  }

  const [campaignsResult, tMetadata] = await Promise.all([
    listCampaignsAction(),
    getTranslations('dashboard.ceoAgent'),
  ]);

  return (
    <CampaignsClient
      locale={initial.locale}
      userId={initial.user.id}
      campaigns={campaignsResult.campaigns ?? []}
      tier={campaignsResult.tier ?? initial.userTier}
      remainingThisMonth={campaignsResult.remainingThisMonth ?? 0}
      titleLabel={tMetadata('campaignsTitle')}
      subtitleLabel={tMetadata('campaignsDesc')}
      emptyTitle={tMetadata('campaignsEmptyTitle')}
      emptyDescription={tMetadata('campaignsEmptyDescription')}
      createCta={tMetadata('campaignsCreateCta')}
      limitReachedLabel={tMetadata('campaignsLimitReached', { limit: campaignsResult.remainingThisMonth ?? 0 })}
      createNewLabel={tMetadata('campaignsCreateNew')}
      cancelLabel={tMetadata('campaignsCancel')}
      generatingLabel={tMetadata('campaignsGenerating')}
      failedLabel={tMetadata('campaignsFailed')}
      draftLabel={tMetadata('campaignsDraft')}
      retryLabel={tMetadata('campaignsRetry')}
      deleteLabel={tMetadata('campaignsDelete')}
      deleteConfirmLabel={tMetadata('campaignsDeleteConfirm')}
    />
  );
}
