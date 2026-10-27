import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { buildCorePagePayload } from '@/seed/aeo';
import { normalizeAeoLocale } from '@/tree/aeo';
import { DualReadPageSection } from '@/forest/components/aeo';
import { GuideVisualPipeline } from './guide-visual-pipeline';
import { GuideBackendAtlas } from './guide-backend-atlas';
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
  const normalizedLocale = normalizeAeoLocale(locale);
  const t = await getTranslations({ locale, namespace: 'guide' });
  const aeoPayload = buildCorePagePayload('guide', normalizedLocale);

  return (
    <main className="min-h-screen bg-background text-foreground py-12 sm:py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          ← {t('back_to_dashboard')}
        </Link>

        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            {t('gettingStarted.hero_title')}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('gettingStarted.hero_subtitle')}
          </p>
        </div>

        <GuideVisualPipeline t={t} locale={normalizedLocale} />
        <GuideBackendAtlas t={t} locale={normalizedLocale} />
        <GuideSections t={t} />
        <DualReadPageSection payload={aeoPayload} />
      </div>
    </main>
  );
}
