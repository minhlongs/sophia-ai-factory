import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { checkCreatorAccess } from '../ServerGate';
import { Suspense } from 'react';
import { Sparkles, CheckCircle, Check } from 'lucide-react';
import { submitCreatorApplication } from './actions';
import { MarketplaceUnavailableNotice } from '@/components/sop-marketplace/marketplace-unavailable-notice';
import { CreatorApplicationFormCard } from './apply-form-fields';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ submitted?: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ApplyPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { submitted } = await searchParams;
  const access = await checkCreatorAccess();

  if (!access.userId) {
    redirect(`/${locale}/auth/login?redirect=/dashboard/sop-creator/apply`);
  }
  if (!access.marketplaceAvailable) {
    return <main className="min-h-screen bg-background p-8"><MarketplaceUnavailableNotice /></main>;
  }
  if (access.hasAccess) {
    redirect(`/${locale}/dashboard/sop-creator`);
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
        <ApplyPageClient locale={locale} submitted={submitted === 'true'} />
      </Suspense>
    </div>
  );
}

async function ApplyPageClient({ locale, submitted }: { locale: string; submitted: boolean }) {
  const t = await getTranslations({ locale, namespace: 'sop.creator' });
  const benefitsItems = t('apply.benefits.items') as unknown as string[];

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">{t('apply.title')}</h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">{t('apply.description')}</p>
        </div>

        {submitted && (
          <div className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-lg p-6 mb-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-green-800 dark:text-green-200 mb-2">{t('apply.submitted.title')}</h2>
            <p className="text-green-700 dark:text-green-300">{t('apply.submitted.description')}</p>
          </div>
        )}

        <div className="bg-card border rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4 text-center">{t('apply.benefits.title')}</h3>
          <ul className="space-y-3">
            {benefitsItems.map((item: string, index: number) => (
              <li key={index} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {!submitted && (
          <form
            action={async (formData: FormData) => {
              'use server';
              await submitCreatorApplication({
                website: String(formData.get('website') || ''),
                niche: String(formData.get('niche') || ''),
                subscribers: String(formData.get('subscribers') || ''),
                monthlyViews: String(formData.get('monthlyViews') || ''),
                experience: String(formData.get('experience') || ''),
                whyJoin: String(formData.get('whyJoin') || ''),
                sampleContent: String(formData.get('sampleContent') || ''),
              });
              redirect(`/${locale}/dashboard/sop-creator/apply?submitted=true`);
            }}
            className="space-y-6"
          >
            <CreatorApplicationFormCard t={t} />

            <p className="text-center text-sm text-muted-foreground">
              {t('apply.form.disclaimer')}
            </p>
          </form>
        )}

        <div className="text-center mt-8">
          <a href={`/${locale}/dashboard`} className="text-primary hover:underline text-sm">
            ← {t('apply.backToDashboard')}
          </a>
        </div>
      </div>
    </main>
  );
}
