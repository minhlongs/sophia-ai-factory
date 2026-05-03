/**
 * Public /status page — no auth, ISR 60s.
 * Shows 90-day uptime grid, active incident banner, last 5 resolved incidents.
 * @module app/status/page
 */

import { getD1Raw } from '@/seed/db/client';
import { getRollup, getActiveIncident, listResolvedIncidents } from '@/land/status/status-store';
import { UptimeGrid } from './uptime-grid';
import { IncidentCard } from './incident-card';
import type { DayRollup, StatusIncident } from '@/land/status/status-store';

export const revalidate = 60;
export const dynamic = 'force-static';

async function getStatusData() {
  try {
    const db = await getD1Raw();
    const [rollup, active, resolved] = await Promise.all([
      getRollup(db, 90),
      getActiveIncident(db),
      listResolvedIncidents(db, 5),
    ]);
    return { rollup, active, resolved };
  } catch {
    return { rollup: [], active: null, resolved: [] };
  }
}

export default async function StatusPage() {
  const { rollup, active, resolved } = await getStatusData();

  const overallStatus = active ? 'degraded' : 'operational';
  const avg90Uptime =
    rollup.length > 0
      ? (rollup.reduce((s, r) => s + r.uptimePct, 0) / rollup.length).toFixed(2)
      : '100.00';

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200 py-16 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Sophia AI Factory Status</h1>
          <p className="text-zinc-400 text-sm">sophia.agencyos.network</p>
        </div>

        {/* Current status pill */}
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8 ${
          overallStatus === 'operational' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' : 'bg-amber-900/40 text-amber-300 border border-amber-700'
        }`}>
          <span className={`w-2 h-2 rounded-full ${overallStatus === 'operational' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          {overallStatus === 'operational' ? 'All Systems Operational' : 'Degraded Performance'}
        </div>

        {/* Active incident banner */}
        {active && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">⚠</span>
              <div>
                <p className="font-semibold text-amber-300">{active.title}</p>
                {active.description && <p className="text-amber-200/80 text-sm mt-1">{active.description}</p>}
                <p className="text-amber-400/70 text-xs mt-2">
                  Started {new Date(active.startedAt * 1000).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 90-day uptime grid */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">90-day uptime</h2>
            <span className="text-emerald-400 text-sm font-mono">{avg90Uptime}%</span>
          </div>
          <UptimeGrid rollup={rollup} />
          <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-600 rounded-sm inline-block" />≥99.5%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-600 rounded-sm inline-block" />95-99.5%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-700 rounded-sm inline-block" />&lt;95%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-zinc-700 rounded-sm inline-block" />No data</span>
          </div>
        </div>

        {/* Resolved incidents */}
        {resolved.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-4">Past Incidents</h2>
            <div className="space-y-4">
              {resolved.map((incident: StatusIncident) => (
                <IncidentCard key={incident.id} incident={incident} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
