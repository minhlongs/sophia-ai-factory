/**
 * Rollback page — shows mission status, rollback history, and rollback trigger.
 * Server component that fetches mission + history data, renders RollbackPanel.
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { getTranslations } from 'next-intl/server';
import { getRollbackHistory } from '@/tree/rollback';
import { RollbackPanel } from '@/components/rollback-panel';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('rollback');
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

interface RollbackPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function RollbackPage({ params }: RollbackPageProps) {
  const { id: missionId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  const d1 = getD1();
  if (!d1) {
    notFound();
  }

  // Get workspace
  const membership = await d1
    .prepare('SELECT org_id, role FROM org_members WHERE user_id = ? LIMIT 1')
    .bind(user.id)
    .first<{ org_id: string; role: string }>();

  if (!membership) {
    notFound();
  }

  // Fetch mission
  const mission = await d1
    .prepare('SELECT id, status FROM missions WHERE id = ?1 AND workspace_id = ?2')
    .bind(missionId, membership.org_id)
    .first<{ id: string; status: string }>();

  if (!mission) {
    notFound();
  }

  // Fetch rollback history
  const historyResult = await getRollbackHistory(missionId);
  const history = historyResult.ok
    ? historyResult.value.filter((r) => r.workspaceId === membership.org_id)
    : [];

  const allowedRoles = ['owner', 'admin'];
  const canRollback = allowedRoles.includes(membership.role) && mission.status !== 'rolled_back';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
      <RollbackPanel
        missionId={missionId}
        missionStatus={mission.status}
        canRollback={canRollback}
        initialHistory={history}
      />
    </div>
  );
}
