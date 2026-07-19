/**
 * /dashboard/finance/reports — P&L / Burn / Runway report view.
 *
 * Server Component: auth-gates, then renders FinanceReportsClient
 * which calls /api/admin/finance/report?period=monthly.
 */
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import FinanceReportsClient from './reports-client';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function FinanceReportsPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  return <FinanceReportsClient locale={locale} />;
}
