/**
 * Autonomy settings page — server component.
 */

import { Metadata } from 'next';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { getTranslations } from 'next-intl/server';
import { AutonomySettings, type MissionTypePolicyRow } from '@/components/autonomy-settings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('autonomy');
  return {
    title: t('pageTitle'),
    description: t('description'),
  };
}

export const dynamic = 'force-dynamic';

export default async function AutonomySettingsPage() {
  const user = await getCurrentUser();
  const d1 = await getD1();

  let initialLevel = 1;
  let initialPolicies: MissionTypePolicyRow[] = [];

  if (user && d1) {
    try {
      const membership = await d1
        .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
        .bind(user.id)
        .first<{ org_id: string }>();

      const workspaceId = membership?.org_id;
      if (workspaceId) {
        const row = await d1
          .prepare(
            'SELECT level FROM autonomy_configs WHERE workspace_id = ?1 AND agent_type = \'global\'',
          )
          .bind(workspaceId)
          .first<{ level: number }>();

        if (row?.level !== undefined) {
          initialLevel = row.level;
        }

        const policyRows = await d1
          .prepare(
            'SELECT mission_type, autonomy_tier, require_publish_approval, ' +
            'max_cost_cents_per_run, max_auto_retries ' +
            'FROM mission_type_policies WHERE workspace_id = ?1 ORDER BY mission_type ASC',
          )
          .bind(workspaceId)
          .all<{
            mission_type: string;
            autonomy_tier: number;
            require_publish_approval: number;
            max_cost_cents_per_run: number | null;
            max_auto_retries: number;
          }>();

        initialPolicies = (policyRows.results ?? []).map((r) => ({
          missionType: r.mission_type,
          autonomyTier: r.autonomy_tier,
          requirePublishApproval: r.require_publish_approval === 1,
          maxCostCentsPerRun: r.max_cost_cents_per_run,
          maxAutoRetries: r.max_auto_retries,
        }));
      }
    } catch {
      // fall back to default
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
      <AutonomySettings initialLevel={initialLevel} initialPolicies={initialPolicies} />
    </div>
  );
}