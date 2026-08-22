/**
 * YouTube Learnings — learning recommendations with approve/reject UI.
 * Server Component: fetches recommendations; renders client LearningsList.
 */

import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { LearningsList } from '../learnings-list';
import { listRecommendations } from '../data';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('youtube');
  return {
    title: t('navLearnings'),
    description: t('learningRecommendations'),
  };
}

export default async function YoutubeLearningsPage() {
  const t = await getTranslations('youtube');
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-rose-600">{t('loading')}</p>
      </div>
    );
  }

  const recommendations = await listRecommendations(user.id, 50);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(240,12%,12%)]">{t('learningRecommendations')}</h1>
        <p className="mt-1 text-sm text-[hsl(240,12%,45%)]">{t('overviewDescription')}</p>
      </header>

      <LearningsList recommendations={recommendations} />
    </div>
  );
}