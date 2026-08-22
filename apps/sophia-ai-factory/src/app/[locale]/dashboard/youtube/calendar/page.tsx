/**
 * YouTube Content Calendar — upcoming scheduled content view.
 * Server Component: lists upcoming entries and renders the calendar grid.
 */

import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { ContentCalendarGrid } from '@/components/youtube/content-calendar-grid';
import { listUpcomingCalendarEntries } from '../data';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('youtube');
  return {
    title: t('navCalendar'),
    description: t('contentCalendar'),
  };
}

export default async function YoutubeCalendarPage() {
  const t = await getTranslations('youtube');
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-rose-600">{t('loading')}</p>
      </div>
    );
  }

  const upcoming = await listUpcomingCalendarEntries(user.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(240,12%,12%)]">{t('contentCalendar')}</h1>
        <p className="mt-1 text-sm text-[hsl(240,12%,45%)]">{t('overviewDescription')}</p>
      </header>

      {upcoming.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('noScheduled')}</p>
        </div>
      ) : (
        <ContentCalendarGrid
          entries={upcoming.map((e) => ({
            id: e.id,
            title: e.title,
            scheduledAt: e.scheduledAt,
            status: e.status,
            contentType: e.contentType,
            topic: e.topic,
          }))}
          onEntryClick={() => {}}
        />
      )}
    </div>
  );
}