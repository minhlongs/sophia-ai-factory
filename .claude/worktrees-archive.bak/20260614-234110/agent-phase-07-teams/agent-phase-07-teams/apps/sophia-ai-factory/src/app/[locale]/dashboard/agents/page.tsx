/**
 * Dashboard Agents page — wraps AgentTeamPanel as a full-page view.
 * Existing AgentTeamPanel polls /api/agents/list and renders agent cards.
 */

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { AgentTeamPanel } from '@/forest/components/missions/agent-team-panel';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const t = await getTranslations('dashboard.missions.control');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('agent_team')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('task_feed')}</p>
      </div>
      <AgentTeamPanel />
    </div>
  );
}
