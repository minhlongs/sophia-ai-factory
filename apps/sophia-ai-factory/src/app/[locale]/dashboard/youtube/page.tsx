/**
 * YouTube Content Pipeline — Overview page.
 * Server Component: fetches recent generations, channel configs, upcoming content.
 */

import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { PipelineStatusCard } from '@/components/youtube/pipeline-status-card';
import { ContentCalendarGrid } from '@/components/youtube/content-calendar-grid';
import { TriggerPipelineButton } from './trigger-pipeline-button';
import {
  listChannelConfigsForUser,
  listRecentCalendarEntries,
  listUpcomingCalendarEntries,
} from './data';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('youtube');
  return {
    title: t('overviewTitle'),
    description: t('overviewDescription'),
  };
}

export default async function YoutubeOverviewPage() {
  const t = await getTranslations('youtube');
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-rose-600">{t('loading')}</p>
      </div>
    );
  }

  const [configs, recent, upcoming] = await Promise.all([
    listChannelConfigsForUser(user.id),
    listRecentCalendarEntries(user.id, 10),
    listUpcomingCalendarEntries(user.id),
  ]);

  const activeConfig = configs[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(240,12%,12%)]">{t('overviewTitle')}</h1>
        <p className="mt-1 text-sm text-[hsl(240,12%,45%)]">{t('overviewDescription')}</p>
      </header>

      {/* Channel config + trigger */}
      <section className="mb-6 rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t('channelConfigs')}</h2>
            {activeConfig ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {activeConfig.channelTitle ?? activeConfig.channelId} · {activeConfig.cadence}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{t('noChannelConfig')}</p>
            )}
          </div>
          {activeConfig ? (
            <TriggerPipelineButton channelConfigId={activeConfig.id} />
          ) : (
            <span className="text-xs text-muted-foreground">{t('noChannelConfigDesc')}</span>
          )}
        </div>
      </section>

      {/* Recent generations */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t('recentGenerations')}</h2>
        {recent.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">{t('noGenerations')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('noGenerationsDesc')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((entry) => (
              <PipelineStatusCard
                key={entry.id}
                jobId={entry.id}
                status={entry.status}
                title={entry.title}
                createdAt={entry.createdAt}
                t={(k) => t(k)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming calendar */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t('upcoming')}</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">{t('noUpcoming')}</p>
          </div>
        ) : (
          <ContentCalendarGrid
            entries={upcoming.map((e) => ({
              id: e.id,
              title: e.title,
              scheduledAt: e.scheduledAt,
              status: e.status,
            }))}
            onEntryClick={() => {}}
          />
        )}
      </section>
    </div>
  );
}