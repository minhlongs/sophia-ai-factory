'use client';

/**
 * Mission Dashboard
 * Shows active missions, mission history, MCU balance, and quick-launch templates.
 */

import { useEffect, useState } from 'react';
import { McuBalanceWidget } from './mcu-balance-widget';

type MissionStatus = 'queued' | 'planning' | 'executing' | 'verifying' | 'completed' | 'failed';

interface Mission {
  id: string;
  title: string;
  status: MissionStatus;
  mcuCost: number;
  createdAt: string;
  completedAt?: string;
}

const STATUS_STYLES: Record<MissionStatus, string> = {
  queued: 'bg-gray-100 text-gray-700',
  planning: 'bg-blue-100 text-blue-700',
  executing: 'bg-orange-100 text-orange-700',
  verifying: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const QUICK_TEMPLATES = [
  { id: 'proposal', label: 'Proposal', icon: 'description', mcu: 25 },
  { id: 'blog', label: 'Blog Post', icon: 'article', mcu: 50 },
  { id: 'social', label: 'Social Bundle', icon: 'share', mcu: 10 },
  { id: 'video', label: 'Video Script', icon: 'play_circle', mcu: 100 },
];

interface Props {
  onLaunchMission?: (templateId?: string) => void;
}

export function MissionDashboard({ onLaunchMission }: Props) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/raas/missions?limit=20')
      .then(r => r.json())
      .then(d => { setMissions(d.missions ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const active = missions.filter(m => !['completed', 'failed'].includes(m.status));
  const history = missions.filter(m => ['completed', 'failed'].includes(m.status));

  return (
    <div className="space-y-6">
      {/* Top row: MCU balance + quick launch */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <McuBalanceWidget />
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Launch</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUICK_TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => onLaunchMission?.(t.id)}
                aria-label={`Quick launch ${t.label}`}
                className="flex flex-col items-center gap-1 p-3 rounded-lg border border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-orange-500 text-2xl">{t.icon}</span>
                <span className="text-xs font-medium text-gray-700">{t.label}</span>
                <span className="text-xs text-gray-400">{t.mcu} MCU</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active missions */}
      {active.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Active Missions ({active.length})</h3>
          <div className="space-y-2">
            {active.map(m => (
              <a key={m.id} href={`/missions/${m.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.title}</p>
                  <p className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{m.mcuCost} MCU</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[m.status]}`}>{m.status}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* History table */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Mission History</h3>
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />)}</div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No missions yet. Launch your first mission above.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map(m => (
              <a key={m.id} href={`/missions/${m.id}`} className="flex items-center justify-between py-2.5 hover:bg-gray-50 px-1 rounded transition-colors">
                <span className="text-sm text-gray-800">{m.title}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{m.mcuCost} MCU</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[m.status]}`}>{m.status}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
