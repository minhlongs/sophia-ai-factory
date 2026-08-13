import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { checkCreatorAccess } from '../ServerGate';
import { Suspense } from 'react';
import { Sparkles, CheckCircle, Check, Send } from 'lucide-react';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ submitted?: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ApplyPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { submitted } = await searchParams;
  const access = await checkCreatorAccess();

  if (access.hasAccess) {
    redirect(`/${locale}/dashboard/sop-creator`);
  }
  if (!access.userId) {
    redirect(`/${locale}/auth/login?redirect=/dashboard/sop-creator/apply`);
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
          <ApplyPageClient locale={locale} submitted={submitted === 'true'} />
        </Suspense>
      </div>
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
          <form action={`/${locale}/dashboard/sop-creator/apply`} method="POST" className="space-y-6">
            <div className="bg-card border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-6 text-center">{t('apply.form.title')}</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-foreground mb-2">
                    {t('apply.form.website.label')}
                  </label>
                  <input type="url" id="website" name="website" className="input w-full" placeholder="https://your-channel.com" required />
                  <p className="text-xs text-muted-foreground mt-1">{t('apply.form.website.hint')}</p>
                </div>

                <div>
                  <label htmlFor="niche" className="block text-sm font-medium text-foreground mb-2">
                    {t('apply.form.niche.label')}
                  </label>
                  <select id="niche" name="niche" className="input w-full" required>
                    <option value="">{t('apply.form.niche.placeholder')}</option>
                    <option value="tech">{t('apply.form.niche.options.tech')}</option>
                    <option value="finance">{t('apply.form.niche.options.finance')}</option>
                    <option value="lifestyle">{t('apply.form.niche.options.lifestyle')}</option>
                    <option value="education">{t('apply.form.niche.options.education')}</option>
                    <option value="gaming">{t('apply.form.niche.options.gaming')}</option>
                    <option value="health">{t('apply.form.niche.options.health')}</option>
                    <option value="business">{t('apply.form.niche.options.business')}</option>
                    <option value="other">{t('apply.form.niche.options.other')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="subscribers" className="block text-sm font-medium text-foreground mb-2">
                    {t('apply.form.subscribers.label')}
                  </label>
                  <select id="subscribers" name="subscribers" className="input w-full" required>
                    <option value="">{t('apply.form.subscribers.placeholder')}</option>
                    <option value="0-1k">{t('apply.form.subscribers.options.0-1k')}</option>
                    <option value="1k-10k">{t('apply.form.subscribers.options.1k-10k')}</option>
                    <option value="10k-100k">{t('apply.form.subscribers.options.10k-100k')}</option>
                    <option value="100k-500k">{t('apply.form.subscribers.options.100k-500k')}</option>
                    <option value="500k+">{t('apply.form.subscribers.options.500k+')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="monthlyViews" className="block text-sm font-medium text-foreground mb-2">
                    {t('apply.form.monthlyViews.label')}
                  </label>
                  <select id="monthlyViews" name="monthlyViews" className="input w-full" required>
                    <option value="">{t('apply.form.monthlyViews.placeholder')}</option>
                    <option value="0-10k">{t('apply.form.monthlyViews.options.0-10k')}</option>
                    <option value="10k-50k">{t('apply.form.monthlyViews.options.10k-50k')}</option>
                    <option value="50k-200k">{t('apply.form.monthlyViews.options.50k-200k')}</option>
                    <option value="200k-1m">{t('apply.form.monthlyViews.options.200k-1m')}</option>
                    <option value="1m+">{t('apply.form.monthlyViews.options.1m+')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="experience" className="block text-sm font-medium text-foreground mb-2">
                    {t('apply.form.experience.label')}
                  </label>
                  <textarea id="experience" name="experience" rows={4} className="input w-full" placeholder={t('apply.form.experience.placeholder')} required />
                  <p className="text-xs text-muted-foreground mt-1">{t('apply.form.experience.hint')}</p>
                </div>

                <div>
                  <label htmlFor="whyJoin" className="block text-sm font-medium text-foreground mb-2">
                    {t('apply.form.whyJoin.label')}
                  </label>
                  <textarea id="whyJoin" name="whyJoin" rows={4} className="input w-full" placeholder={t('apply.form.whyJoin.placeholder')} required />
                  <p className="text-xs text-muted-foreground mt-1">{t('apply.form.whyJoin.hint')}</p>
                </div>

                <div>
                  <label htmlFor="sampleContent" className="block text-sm font-medium text-foreground mb-2">
                    {t('apply.form.sampleContent.label')}
                  </label>
                  <input type="url" id="sampleContent" name="sampleContent" className="input w-full" placeholder="https://youtube.com/watch?v=..." />
                  <p className="text-xs text-muted-foreground mt-1">{t('apply.form.sampleContent.hint')}</p>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full mt-6 py-3 text-lg">
                <Send className="w-5 h-5 mr-2" />
                {t('apply.form.submit')}
              </button>
            </div>

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