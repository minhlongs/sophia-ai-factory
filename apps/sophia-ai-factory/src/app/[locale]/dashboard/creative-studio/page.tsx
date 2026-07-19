import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CreativeStudioTabs } from './creative-studio-tabs';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CreativeStudioPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/auth/signup`);
  const tier = await resolveUserTier(user.id);
  const t = await getTranslations({ locale, namespace: 'creativeStudio' });
  const activeTab = typeof sp?.tab === 'string' ? sp.tab : 'video';
  const statCards = [
    { key: 'video', label: t('stats.video.label'), value: t('stats.video.value') },
    { key: 'image', label: t('stats.image.label'), value: t('stats.image.value') },
    { key: 'audio', label: t('stats.audio.label'), value: t('stats.audio.value') },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[linear-gradient(135deg,transparent_0%,hsl(var(--primary)/0.08)_45%,hsl(var(--accent)/0.10)_100%)] sm:block" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {t('eyebrow')}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t('title')}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              {t('subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            {statCards.map((stat) => (
              <div key={stat.key} className="rounded-lg border border-border bg-background/80 p-3">
                <p className="text-[11px] font-medium uppercase text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <CreativeStudioTabs tier={tier} activeTab={activeTab} locale={locale} />
    </div>
  );
}
