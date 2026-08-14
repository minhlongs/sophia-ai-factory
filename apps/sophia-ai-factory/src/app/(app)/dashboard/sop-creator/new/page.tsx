import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { checkCreatorAccess } from '../ServerGate';
import { Suspense } from 'react';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';

export default async function NewListingPage({ params }: PageProps) {
  const { locale } = await params;
  const access = await checkCreatorAccess();

  if (!access.hasAccess) {
    redirect(`/${locale}/dashboard/sop-creator/apply`);
  }
  if (!access.userId) {
    redirect(`/${locale}/auth/login?redirect=/dashboard/sop-creator/new`);
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto">
        <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
          <NewListingPageClient locale={locale} userId={access.userId!} />
        </Suspense>
      </div>
    </main>
  );
}

async function NewListingPageClient({ locale, userId }: { locale: string; userId: string }) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const t = await getTranslations({ locale, namespace: 'sop.creator' });

  return (
    <form action={`/${locale}/dashboard/sop-creator/new`} method="POST" className="space-y-6">
      <div className="mb-8">
        <a
          href={`/${locale}/dashboard/sop-creator`}
          className="inline-flex items-center gap-2 text-primary hover:underline text-sm mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> {t('new.back')}
        </a>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t('new.title')}</h1>
          <p className="text-lg text-muted-foreground mt-2">{t('new.subtitle')}</p>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6 text-center">{t('new.form.title')}</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">
              {t('new.form.fields.title.label')} <span className="text-red-500">*</span>
            </label>
            <input type="text" id="title" name="title" required placeholder={t('new.form.fields.title.placeholder')} className="input w-full" />
            <p className="text-xs text-muted-foreground">{t('new.form.fields.title.hint')}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="sopTemplateId" className="block text-sm font-medium text-foreground mb-2">
              {t('new.form.fields.sopTemplateId.label')} <span className="text-red-500">*</span>
            </label>
            <input type="text" id="sopTemplateId" name="sopTemplateId" required placeholder={t('new.form.fields.sopTemplateId.placeholder')} className="input w-full font-mono" />
            <p className="text-xs text-muted-foreground">{t('new.form.fields.sopTemplateId.hint')}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="priceCents" className="block text-sm font-medium text-foreground mb-2">
              {t('new.form.fields.priceCents.label')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <input type="number" id="priceCents" name="priceCents" step="0.01" min="0" required placeholder="0.00" className="input w-full pl-7" value="0.00" />
            </div>
            <p className="text-xs text-muted-foreground">{t('new.form.fields.priceCents.hint')}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="category" className="block text-sm font-medium text-foreground mb-2">
              {t('new.form.fields.category.label')}
            </label>
            <select id="category" name="category" className="input w-full" defaultValue="">
              <option value="">{t('new.form.fields.category.placeholder')}</option>
              <option value="content">{t('new.form.fields.category.options.content')}</option>
              <option value="leads">{t('new.form.fields.category.options.leads')}</option>
              <option value="email">{t('new.form.fields.category.options.email')}</option>
              <option value="analytics">{t('new.form.fields.category.options.analytics')}</option>
              <option value="proposals">{t('new.form.fields.category.options.proposals')}</option>
              <option value="social">{t('new.form.fields.category.options.social')}</option>
              <option value="other">{t('new.form.fields.category.options.other')}</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">
              {t('new.form.fields.description.label')}
            </label>
            <textarea id="description" name="description" rows={4} placeholder={t('new.form.fields.description.placeholder')} className="input w-full" />
            <p className="text-xs text-muted-foreground">{t('new.form.fields.description.hint')}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="tags" className="block text-sm font-medium text-foreground mb-2">
              {t('new.form.fields.tags.label')}
            </label>
            <input type="text" id="tags" name="tags" placeholder={t('new.form.fields.tags.placeholder')} className="input w-full" />
            <p className="text-xs text-muted-foreground">{t('new.form.fields.tags.hint')}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="thumbnailUrl" className="block text-sm font-medium text-foreground mb-2">
              {t('new.form.fields.thumbnailUrl.label')}
            </label>
            <input type="url" id="thumbnailUrl" name="thumbnailUrl" placeholder={t('new.form.fields.thumbnailUrl.placeholder')} className="input w-full" />
            <p className="text-xs text-muted-foreground">{t('new.form.fields.thumbnailUrl.hint')}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="demovideoUrl" className="block text-sm font-medium text-foreground mb-2">
              {t('new.form.fields.demovideoUrl.label')}
            </label>
            <input type="url" id="demovideoUrl" name="demovideoUrl" placeholder={t('new.form.fields.demovideoUrl.placeholder')} className="input w-full" />
            <p className="text-xs text-muted-foreground">{t('new.form.fields.demovideoUrl.hint')}</p>
          </div>

          <button type="submit" className="btn btn-primary w-full mt-6 py-3 text-lg">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            {t('new.form.submit')}
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {t('new.form.disclaimer')}
        </p>
      </div>
    </form>
  );
}