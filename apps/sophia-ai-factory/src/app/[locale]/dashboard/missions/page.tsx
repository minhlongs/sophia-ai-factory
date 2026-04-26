/**
 * Dashboard Missions Page
 *
 * Mission Control layout: NL input + agent team panel + live SSE feed
 * Preserves existing MissionDashboard and MissionLauncher below.
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MissionDashboard } from '@/components/raas/mission-dashboard';
import { MissionLauncher } from '@/components/raas/mission-launcher';
import { MissionControlHeader } from '@/components/missions/mission-control-header';
import { AgentTeamPanel } from '@/components/missions/agent-team-panel';
import { TaskFeed } from '@/components/missions/task-feed';
import { useRouter } from 'next/navigation';

export default function MissionsPage() {
  const t = useTranslations('dashboard.missions');
  const router = useRouter();
  const [showLauncher, setShowLauncher] = useState(false);
  const [balance, setBalance] = useState(0);

  function handleLaunchMission(_templateId?: string) {
    fetch('/api/raas/usage')
      .then(r => r.json())
      .then(d => setBalance((d as { balance?: number }).balance ?? 0))
      .catch(() => {})
      .finally(() => setShowLauncher(true));
  }

  function handleMissionCreated(missionId: string) {
    router.push(`/dashboard/missions/${missionId}`);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('page_title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('page_subtitle')}</p>
        </div>
        <button
          onClick={() => handleLaunchMission()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined text-base">rocket_launch</span>
          {t('new_mission')}
        </button>
      </div>

      {/* Mission Control: NL input + Quick Actions */}
      <MissionControlHeader onMissionCreated={handleMissionCreated} />

      {/* Agent Team Panel + Live Task Feed */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AgentTeamPanel />
        <TaskFeed />
      </div>

      {/* Existing dashboard (history + quick templates) */}
      <MissionDashboard onLaunchMission={handleLaunchMission} />

      {showLauncher && (
        <MissionLauncher
          balance={balance}
          onClose={() => setShowLauncher(false)}
          onSuccess={handleMissionCreated}
        />
      )}
    </div>
  );
}
