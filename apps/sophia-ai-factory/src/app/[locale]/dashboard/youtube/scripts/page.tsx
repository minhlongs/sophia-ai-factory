/**
 * YouTube Scripts — script viewer for generated scripts.
 * Server Component: lists scripts; shows the first one in the viewer.
 */

import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { ScriptViewer } from '@/components/youtube/script-viewer';
import { listScripts } from '../data';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('youtube');
  return {
    title: t('navScripts'),
    description: t('scriptViewer'),
  };
}

export default async function YoutubeScriptsPage() {
  const t = await getTranslations('youtube');
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-rose-600">{t('loading')}</p>
      </div>
    );
  }

  const scripts = await listScripts(user.id, 20);
  const selected = scripts[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(240,12%,12%)]">{t('scriptViewer')}</h1>
        <p className="mt-1 text-sm text-[hsl(240,12%,45%)]">{t('overviewDescription')}</p>
      </header>

      {scripts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('noScript')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Script list */}
          <aside className="lg:col-span-1">
            <h2 className="mb-3 text-sm font-semibold text-foreground">{t('navScripts')}</h2>
            <ul className="space-y-2">
              {scripts.map((s) => (
                <li
                  key={s.id}
                  className={`rounded-lg border p-3 text-sm ${
                    selected?.id === s.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background'
                  }`}
                >
                  <p className="truncate font-medium text-foreground">{s.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          </aside>

          {/* Script viewer */}
          <div className="lg:col-span-2">
            {selected ? (
              <ScriptViewer
                script={{
                  id: selected.id,
                  title: selected.title,
                  hook: selected.hook,
                  introduction: selected.introduction,
                  mainContent: selected.mainContent,
                  conclusion: selected.conclusion,
                  callToAction: selected.callToAction,
                  duration: selected.duration,
                  tone: selected.tone,
                  pacing: selected.pacing,
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t('noScript')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}