/**
 * YouTube Strategy — strategy history + manual trigger.
 * Server Component: lists generated strategies per channel config.
 */

import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listChannelConfigsForUser, listStrategies } from '../data';
import { TriggerPipelineButton } from '../trigger-pipeline-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('youtube');
  return {
    title: t('navStrategy'),
    description: t('strategyHistory'),
  };
}

export default async function YoutubeStrategyPage() {
  const t = await getTranslations('youtube');
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-rose-600">{t('loading')}</p>
      </div>
    );
  }

  const [configs, strategies] = await Promise.all([
    listChannelConfigsForUser(user.id),
    listStrategies(user.id, 20),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(240,12%,12%)]">{t('strategyHistory')}</h1>
        <p className="mt-1 text-sm text-[hsl(240,12%,45%)]">{t('overviewDescription')}</p>
      </header>

      <section className="mb-6 rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t('channelConfigs')}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {configs.length} {configs.length === 1 ? 'config' : 'configs'}
            </p>
          </div>
          {configs[0] ? (
            <TriggerPipelineButton channelConfigId={configs[0].id} />
          ) : (
            <span className="text-xs text-muted-foreground">{t('noChannelConfigDesc')}</span>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t('strategyHistory')}</h2>
        {strategies.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">{t('noStrategies')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t('topic')}</th>
                  <th className="px-4 py-3">{t('contentType')}</th>
                  <th className="px-4 py-3">{t('status')}</th>
                  <th className="px-4 py-3">{t('createdAt')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {strategies.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{s.topic}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.contentType ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}