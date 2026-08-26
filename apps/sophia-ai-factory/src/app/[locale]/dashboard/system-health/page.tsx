/**
 * System Health dashboard — server component.
 *
 * Surfaces the autonomous production pipeline KPIs (completion %, approval
 * turnaround, retry success %, spend/run, active runs, pending approvals),
 * the pending-approvals queue, and mounts the previously-orphaned
 * HarnessHealthCard. Membership resolution mirrors the creative-economy
 * dashboard: first org by created_at. Empty database is safe — every KPI
 * degrades to a "no data" state.
 */

export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import {
  getProductionDashboardSummary,
  getPendingApprovals,
} from '@/land/production-monitoring/dashboard-summary';
import type {
  PendingApprovalRow,
  ProductionDashboardSummary,
  ProductionMonitoringResult,
} from '@/land/production-monitoring/types';
import { KpiCards } from '@/components/production-monitoring/kpi-cards';
import { PendingApprovalsList } from '@/components/production-monitoring/pending-approvals-list';
import { QueryProvider } from '@/forest/components/providers/query-provider';
import { HarnessHealthCard } from './components/harness-health-card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('productionMonitoring');
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

type TFn = (key: string, values?: Record<string, string | number | Date>) => string;

function SectionError({ message, t }: { message: string; t: TFn }) {
  return (
    <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      {t('sectionError')}: {message}
    </div>
  );
}

function KpiSection({
  result,
  t,
}: {
  result: ProductionMonitoringResult<ProductionDashboardSummary>;
  t: TFn;
}) {
  if (!result.ok) return <SectionError message={result.error.message} t={t} />;
  return <KpiCards summary={result.value} t={t} />;
}

function ApprovalsSection({
  result,
  t,
}: {
  result: ProductionMonitoringResult<PendingApprovalRow[]>;
  t: TFn;
}) {
  if (!result.ok) return <SectionError message={result.error.message} t={t} />;
  return <PendingApprovalsList approvals={result.value} t={t} />;
}

export default async function SystemHealthPage() {
  const t = await getTranslations('productionMonitoring');

  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-rose-600">{t('notAuthenticated')}</p>
      </div>
    );
  }

  const db = await getD1();
  if (!db) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-rose-600">{t('dbUnavailable')}</p>
      </div>
    );
  }

  const membership = await db
    .prepare('SELECT org_id FROM org_members WHERE user_id = ? ORDER BY created_at ASC LIMIT 1')
    .bind(user.id)
    .first<{ org_id: string }>();

  if (!membership?.org_id) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-[hsl(240,12%,45%)]">{t('noWorkspace')}</p>
      </div>
    );
  }

  const workspaceId = membership.org_id;

  const [summaryRes, approvalsRes] = await Promise.all([
    getProductionDashboardSummary(workspaceId),
    getPendingApprovals(workspaceId, 10),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(240,12%,12%)]">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-[hsl(240,12%,45%)]">{t('pageDescription')}</p>
      </header>

      <KpiSection result={summaryRes} t={(k, v) => t(k, v)} />
      <ApprovalsSection result={approvalsRes} t={(k, v) => t(k, v)} />

      <div className="mt-8">
        <QueryProvider>
          <HarnessHealthCard />
        </QueryProvider>
      </div>
    </div>
  );
}
