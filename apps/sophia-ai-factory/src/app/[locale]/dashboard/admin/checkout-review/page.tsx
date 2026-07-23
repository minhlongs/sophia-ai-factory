import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CheckoutReviewClient } from './checkout-review-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.checkoutReview' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function CheckoutReviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.checkoutReview' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <CheckoutReviewClient localePromise={Promise.resolve(locale)} />
    </div>
  );
}
