import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
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
  const tier = await getUserTier(user.id);
  const t = await getTranslations({ locale, namespace: 'creativeStudio' });
  const activeTab = typeof sp?.tab === 'string' ? sp.tab : 'video';

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>
      <CreativeStudioTabs tier={tier} activeTab={activeTab} locale={locale} />
    </div>
  );
}
