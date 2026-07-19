/**
 * CEO Agent Daily Briefing — `/dashboard/ceo-agent/briefing`
 *
 * Server Component: resolves auth + tier via `loadCeoAgentPage`, generates
 * today's briefing via the existing forest agent (`generateDailyBriefing`), and
 * passes the result (and a manual-refresh server action) to the hydrated
 * client `BriefingClient`. BASIC tier is blocked at the root page; this page
 * assumes `hasAccess` is true.
 */

import { loadCeoAgentPage } from '@/land/ceo-agent/load-ceo-agent-page';
import { generateDailyBriefing } from '@/forest/agents/daily-briefing/briefing-generator';
import { getTranslations } from 'next-intl/server';
import { BriefingClient } from './briefing-client';
import { refreshBriefingAction } from './actions';

export const dynamic = 'force-dynamic';

export interface BriefingPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: BriefingPageProps) {
  const { locale } = await params;
  const t = await getTranslations('dashboard.ceoAgent');
  return {
    title: `${t('briefingTitle')} | Sophia AI`,
    description: t('briefingDesc'),
  };
}

export default async function BriefingPage({ params }: BriefingPageProps) {
  const initial = await loadCeoAgentPage({ params });
  const hasAccess = initial.userTier !== 'BASIC';

  if (!hasAccess) {
    // Type-safe redirect back to root; tier gate rendered there.
    // We return a minimal fragment because `redirect()` throws.
    return null;
  }

  const [briefing, tMetadata] = await Promise.all([
    generateDailyBriefing(initial.user.id, initial.locale),
    getTranslations('dashboard.ceoAgent'),
  ]);

  return (
    <BriefingClient
      locale={initial.locale}
      userId={initial.user.id}
      initialBriefing={briefing}
      refreshAction={refreshBriefingAction}
      todayLabel={tMetadata('briefingDate', { date: new Date().toLocaleDateString(initial.locale === 'vi' ? 'vi-VN' : 'en-US') })}
      refreshLabel={tMetadata('briefingRefresh')}
      errorLabel={tMetadata('briefingError')}
      emptyLabel={tMetadata('briefingEmpty')}
      retryLabel={tMetadata('briefingRetry')}
    />
  );
}
