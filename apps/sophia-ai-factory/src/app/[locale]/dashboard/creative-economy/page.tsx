/**
 * Creative Economy Dashboard — server component.
 * Read-only surfacing of learning-loop value: 30-day summary, top assets,
 * learning velocity, creative memory, and playbook health.
 *
 * Membership resolution mirrors the monetization dashboard: first org by
 * created_at. All five land actions run in parallel; each section degrades
 * independently on failure.
 */

export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import {
  getDashboardSummary,
  getAssetPerformance,
  getCreativeMemory,
  getPlaybookHealth,
  getLearningVelocity,
  getInvestmentAdvice,
  type DashboardResult,
  type DashboardSummary,
  type AssetPerformanceRow,
  type MemoryInsight,
  type PlaybookHealthRow,
  type VelocityPoint,
  type InvestmentAdviceRow,
} from '@/land/creative-economy';
import { SummaryCards } from './summary-cards';
import { AssetTable } from './asset-table';
import { MemoryList } from './memory-list';
import { PlaybookCards } from './playbook-cards';
import { VelocityChart } from './velocity-chart';
import { InvestmentAdvice } from './investment-advice';

function SectionError({ message, t }: { message: string; t: (key: string) => string }) {
  return (
    <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      {t('sectionError')}: {message}
    </div>
  );
}

export default async function CreativeEconomyPage() {
  const t = await getTranslations('creativeEconomy');

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

  const [summaryRes, assetsRes, memoryRes, playbookRes, velocityRes, investmentRes] =
    await Promise.all([
      getDashboardSummary({ workspaceId }),
      getAssetPerformance({ workspaceId, limit: 10 }),
      getCreativeMemory({ workspaceId, limit: 5 }),
      getPlaybookHealth({ workspaceId }),
      getLearningVelocity({ workspaceId }),
      getInvestmentAdvice({ workspaceId }),
    ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(240,12%,12%)]">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-[hsl(240,12%,45%)]">{t('pageDescription')}</p>
      </header>

      <SummarySection result={summaryRes} t={(k, v) => t(k, v)} />
      <AssetSection result={assetsRes} t={(k, v) => t(k, v)} />
      <VelocitySection result={velocityRes} t={(k, v) => t(k, v)} />
      <MemorySection result={memoryRes} t={(k, v) => t(k, v)} />
      <PlaybookSection result={playbookRes} t={(k, v) => t(k, v)} />
      <InvestmentSection result={investmentRes} t={(k, v) => t(k, v)} />
    </div>
  );
}

type TFn = (key: string, values?: Record<string, string | number | Date>) => string;

function SummarySection({
  result,
  t,
}: {
  result: DashboardResult<DashboardSummary>;
  t: TFn;
}) {
  if (!result.ok) return <SectionError message={result.error.message} t={t} />;
  return (
    <div className="mt-2">
      <SummaryCards summary={result.value} t={t} />
    </div>
  );
}

function AssetSection({
  result,
  t,
}: {
  result: DashboardResult<AssetPerformanceRow[]>;
  t: TFn;
}) {
  if (!result.ok) return <SectionError message={result.error.message} t={t} />;
  return <AssetTable rows={result.value} t={t} />;
}

function VelocitySection({
  result,
  t,
}: {
  result: DashboardResult<VelocityPoint[]>;
  t: TFn;
}) {
  if (!result.ok) return <SectionError message={result.error.message} t={t} />;
  return <VelocityChart points={result.value} t={t} />;
}

function MemorySection({
  result,
  t,
}: {
  result: DashboardResult<MemoryInsight[]>;
  t: TFn;
}) {
  if (!result.ok) return <SectionError message={result.error.message} t={t} />;
  return (
    <div className="mt-6">
      <MemoryList insights={result.value} t={t} />
    </div>
  );
}

function PlaybookSection({
  result,
  t,
}: {
  result: DashboardResult<PlaybookHealthRow[]>;
  t: TFn;
}) {
  if (!result.ok) return <SectionError message={result.error.message} t={t} />;
  return (
    <div className="mt-6">
      <PlaybookCards rows={result.value} t={t} />
    </div>
  );
}

function InvestmentSection({
  result,
  t,
}: {
  result: DashboardResult<InvestmentAdviceRow[]>;
  t: TFn;
}) {
  if (!result.ok) return <SectionError message={result.error.message} t={t} />;
  return <InvestmentAdvice rows={result.value} t={t} />;
}
