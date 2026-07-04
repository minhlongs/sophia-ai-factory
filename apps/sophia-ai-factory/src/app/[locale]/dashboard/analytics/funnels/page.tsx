/**
 * /dashboard/analytics/funnels — Funnel visualization dashboard.
 *
 * Server Component. Displays 4 conversion funnels:
 *   1. Landing → Signup (activation)
 *   2. Onboarding → First Video
 *   3. Video → Paid
 *   4. Campaign lifecycle
 *
 * Fetches data directly from D1 via getFunnelDashboard().
 * Bilingual (Vietnamese + English) via getTranslations('dashboard.analytics').
 */

import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getFunnelDashboard, type FunnelDashboard } from '@/land/analytics/funnel-dashboard';
import { FunnelChart } from '@/forest/components/analytics/funnel-chart';
import { TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

const DAY_SEC = 86400;

export async function generateMetadata(): Promise<{ title: string; description: string }> {
  const t = await getTranslations('dashboard.analytics');
  return {
    title: t('funnel_page_title'),
    description: t('funnel_page_desc'),
  };
}

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function FunnelsPage({ params }: PageProps): Promise<React.JSX.Element> {
  await params;
  const t = await getTranslations('dashboard.analytics');

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const now = Math.floor(Date.now() / 1000);
  let dashboard: FunnelDashboard;

  try {
    dashboard = await getFunnelDashboard(now - 90 * DAY_SEC, now);
  } catch {
    return (
      <div className="space-y-6">
        <header className="flex items-start gap-3">
          <TrendingUp className="w-6 h-6 text-primary-400 mt-1 shrink-0" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold">{t('funnel_page_title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('funnel_page_desc')}</p>
          </div>
        </header>
        <div
          role="alert"
          className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200"
        >
          {t('funnel_error')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <TrendingUp className="w-6 h-6 text-primary-400 mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">{t('funnel_page_title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('funnel_page_desc')}</p>
        </div>
      </header>

      <p className="text-xs text-muted-foreground/60">
        {t('funnel_date_range', { days: '90' })}
      </p>

      <FunnelChart funnels={dashboard.funnels} />
    </div>
  );
}
