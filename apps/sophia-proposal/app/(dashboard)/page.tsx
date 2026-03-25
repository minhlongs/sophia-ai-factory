'use client';

/**
 * Dashboard Overview Page — main landing after login.
 * Shows org welcome, quick stats, recent missions, quick actions.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface StatsData {
  orgName: string;
  totalMissions: number;
  mcuBalance: number;
  activeProposals: number;
}

interface RecentMission {
  id: string;
  title: string;
  status: string;
  mcuCost: number;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  queued:    'bg-gray-100 text-gray-700',
  planning:  'bg-blue-100 text-blue-700',
  executing: 'bg-orange-100 text-orange-700',
  verifying: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
};

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [missions, setMissions] = useState<RecentMission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/org').then(r => r.json()),
      fetch('/api/billing/subscription').then(r => r.json()),
      fetch('/api/raas/missions?limit=5').then(r => r.json()),
    ])
      .then(([org, billing, missionsData]) => {
        setStats({
          orgName:        org.name ?? 'Your Org',
          totalMissions:  missionsData.total ?? missionsData.missions?.length ?? 0,
          mcuBalance:     billing.balance?.balance ?? 0,
          activeProposals: 0,
        });
        setMissions(missionsData.missions ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Total Missions',    value: stats?.totalMissions ?? 0, icon: 'rocket_launch', color: 'text-orange-500' },
    { label: 'MCU Balance',       value: stats?.mcuBalance ?? 0,    icon: 'toll',          color: 'text-green-500' },
    { label: 'Active Proposals',  value: stats?.activeProposals ?? 0, icon: 'description', color: 'text-blue-500' },
  ];

  const quickActions = [
    { href: '/missions',              label: 'New Mission',  icon: 'rocket_launch', primary: true },
    { href: '/proposals',             label: 'New Proposal', icon: 'description',   primary: false },
    { href: '/settings/api-keys',     label: 'API Keys',     icon: 'key',           primary: false },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">
          {loading ? 'Loading…' : `Welcome, ${stats?.orgName}`}
        </h1>
        <p className="text-orange-100 text-sm">Sophia AI Factory — RaaS Dashboard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className={`material-symbols-outlined text-xl ${color}`}>{icon}</span>
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '—' : value.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map(({ href, label, icon, primary }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                primary
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="material-symbols-outlined text-base">{icon}</span>
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Missions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Missions</h2>
          <Link href="/missions" className="text-xs text-orange-600 hover:underline font-medium">
            View all
          </Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="space-y-px">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-gray-50 animate-pulse" />
              ))}
            </div>
          ) : missions.length === 0 ? (
            <div className="py-10 text-center">
              <span className="material-symbols-outlined text-3xl text-gray-300">rocket_launch</span>
              <p className="text-sm text-gray-500 mt-2">No missions yet.</p>
              <Link href="/missions" className="text-sm text-orange-600 hover:underline mt-1 inline-block">
                Launch your first mission
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {missions.map(m => (
                <li key={m.id}>
                  <Link
                    href={`/missions/${m.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.title}</p>
                      <p className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{m.mcuCost} MCU</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_BADGE[m.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {m.status}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
