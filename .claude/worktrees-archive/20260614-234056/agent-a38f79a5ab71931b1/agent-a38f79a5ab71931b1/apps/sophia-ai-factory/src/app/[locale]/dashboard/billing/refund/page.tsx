/**
 * Dashboard Billing → Request Refund page.
 * Auth-gated server component; pre-fetches refundable purchases for the picker.
 *
 * @module app/[locale]/dashboard/billing/refund/page
 */

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listRefundablePurchasesAction } from '../actions';
import { RefundFormClient } from './refund-form-client';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function RefundPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const [t, purchases] = await Promise.all([
    getTranslations({ locale, namespace: 'dashboard.billing.refund' }),
    listRefundablePurchasesAction(),
  ]);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-1">{t('pageSubtitle')}</p>
      </div>
      <RefundFormClient purchases={purchases} />
    </div>
  );
}
