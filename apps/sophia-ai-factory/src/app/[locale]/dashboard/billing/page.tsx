/**
 * Dashboard Billing Page — server gate
 *
 * Auth-gates via getCurrentUser(); renders BillingClient for authenticated users.
 *
 * @module app/[locale]/dashboard/billing/page
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import BillingClient from './billing-client';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function BillingPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return <BillingClient params={params} />;
}
