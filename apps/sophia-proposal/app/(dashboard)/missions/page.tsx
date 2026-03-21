'use client';

/**
 * Missions Dashboard Page
 * Wraps MissionDashboard + MissionLauncher with MCU balance state.
 */

import { useEffect, useState } from 'react';
import { MissionDashboard } from '@/components/raas/mission-dashboard';
import { MissionLauncher } from '@/components/raas/mission-launcher';

export default function MissionsPage() {
  const [showLauncher, setShowLauncher] = useState(false);
  const [balance, setBalance] = useState(0);
  const [launchTemplate, setLaunchTemplate] = useState<string | undefined>();

  useEffect(() => {
    fetch('/api/billing/subscription')
      .then(r => r.json())
      .then(d => setBalance(d.balance?.balance ?? 0))
      .catch(() => {});
  }, []);

  function handleLaunch(templateId?: string) {
    setLaunchTemplate(templateId);
    setShowLauncher(true);
  }

  function handleSuccess(missionId: string) {
    window.location.href = `/missions/${missionId}`;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Missions</h1>
          <p className="text-gray-500 text-sm mt-0.5">Run AI-powered tasks via OpenClaw RaaS</p>
        </div>
        <button
          onClick={() => handleLaunch()}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl font-semibold text-sm hover:bg-orange-600 transition-colors"
        >
          <span className="material-symbols-outlined text-base">rocket_launch</span>
          New Mission
        </button>
      </div>

      <MissionDashboard onLaunchMission={handleLaunch} />

      {showLauncher && (
        <MissionLauncher
          balance={balance}
          onClose={() => setShowLauncher(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
