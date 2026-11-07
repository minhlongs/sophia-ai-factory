import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { buildCorePagePayload } from '@/seed/aeo';
import { normalizeAeoLocale } from '@/tree/aeo';
import { DualReadPageSection } from '@/forest/components/aeo';
import type { GuideActiveTarget } from '@/seed/guide';
import { GuideSections } from './guide-sections';
import { GuideWorkbench } from './guide-workbench';

export const dynamic = 'force-static';

/** Landing view: the first station of the pipeline, with no hash to read. */
const GUIDE_INITIAL_TARGET: GuideActiveTarget = { mode: 'stage', step: 1 };

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
    <main className="v3-core min-h-screen bg-background text-foreground py-12 sm:py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/dashboard"
          className="btn btn-ghost mb-8"
        >
          ← {t('back_to_dashboard')}
        </Link>

        {/* .v3-core Telemetry Hero */}
        <div className="mb-12 text-center">
          <p className="eyebrow justify-center">
            <span className="dot" aria-hidden="true" />
            <span>{t('gettingStarted.hero_eyebrow')}</span>
          </p>
          <h1 className="h2 text-3xl sm:text-4xl font-bold text-foreground mb-3">
            {t('gettingStarted.hero_title')}
          </h1>
          <p className="lead text-muted-foreground max-w-2xl mx-auto">
            {t('gettingStarted.hero_subtitle')}
          </p>
        </div>

        <GuideWorkbench locale={normalizedLocale} initialTarget={GUIDE_INITIAL_TARGET} />

        <GuideSections t={t} />
        <DualReadPageSection payload={aeoPayload} />
      </div>
    </main>
  );
}
