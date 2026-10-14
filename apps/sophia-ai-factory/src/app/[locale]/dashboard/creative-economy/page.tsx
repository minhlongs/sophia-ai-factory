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
import { resolveOrgId } from '@/seed/auth/workspace-access';
import {
  getDashboardSummary,
  getAssetPerformance,
  getCreativeMemory,
  getPlaybookHealth,
  getLearningVelocity,
  getInvestmentAdvice,
} from '@/land/creative-economy';
import {
  SummarySection,
  AssetSection,
  VelocitySection,
  MemorySection,
  PlaybookSection,
  InvestmentSection,
} from './dashboard-sections';

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

  const workspaceId = await resolveOrgId(user.id, db);

  if (!workspaceId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-sm text-[hsl(240,12%,45%)]">{t('noWorkspace')}</p>
      </div>
    );
  }

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
