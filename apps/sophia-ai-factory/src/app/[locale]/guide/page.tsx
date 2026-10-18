import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { GuideSections } from './guide-sections';

export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guide' });
  return {
    title: `${t('gettingStarted.hero_title')} | Sophia AI Factory`,
    description: t('gettingStarted.hero_subtitle'),
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guide' });

  return (
    <main className="min-h-screen bg-background text-foreground py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          {t('back_to_dashboard')}
        </Link>

        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-white mb-3">
            {t('gettingStarted.hero_title')}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t('gettingStarted.hero_subtitle')}
          </p>
        </div>

        <GuideSections t={t} />
      </div>
    </main>
  );
}
