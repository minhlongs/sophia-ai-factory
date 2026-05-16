/**
 * Experiments Dashboard Page
 *
 * Non-tech CEO view of all A/B title+thumbnail experiments.
 * Shows active experiments + decided winners in plain language.
 *
 * Server component — fetches experiments from D1 server-side.
 * Uses getAllExperiments from experiment-store (forest/ab layer).
 *
 * @module app/[locale]/dashboard/experiments/page
 */

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getAllExperiments } from '@/forest/ab/experiment-store';
import { ExperimentsWidget } from './experiments-widget';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Experiments | Sophia AI',
  description: 'A/B title and thumbnail experiments — see which variant wins',
};

export default async function ExperimentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const t = await getTranslations('experiments');

  const experiments = await getAllExperiments(user.id, 50).catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>
      <ExperimentsWidget experiments={experiments} />
    </div>
  );
}
