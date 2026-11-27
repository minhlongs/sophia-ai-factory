// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
import { getLocale } from 'next-intl/server';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { MonitoringDashboardView } from './components/monitoring-dashboard-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Monitoring | Admin | Sophia AI' };

export default async function MonitoringPage({
  params,
}: {
  params: Promise<{ locale?: string }>;
}): Promise<React.JSX.Element> {
  const routeParams = await params;
  const activeLocale = routeParams?.locale || (await getLocale().catch(() => 'vi')) || 'vi';
  await requireMasterTier();
  return <MonitoringDashboardView locale={activeLocale} />;
}
