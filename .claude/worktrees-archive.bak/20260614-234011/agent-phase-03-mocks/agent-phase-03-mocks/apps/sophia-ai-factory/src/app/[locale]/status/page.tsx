/**
 * Public /status page — no auth, ISR 60s.
 * Shows 90-day uptime grid, active incident banner, last 5 resolved incidents.
 * @module app/status/page
 */

import { getTranslations } from 'next-intl/server';
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

export default async function StatusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'status' });
  const { rollup, active, resolved } = await getStatusData();

  const overallStatus = active ? 'degraded' : 'operational';
  const avg90Uptime =
    rollup.length > 0
      ? (rollup.reduce((s, r) => s + r.uptimePct, 0) / rollup.length).toFixed(2)
      : '100.00';
  const intlLocale = locale === 'vi' ? 'vi-VN' : 'en-US';

  return (
    <main className="min-h-screen bg-background text-foreground py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">sophia.agencyos.network</p>
        </div>

        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8 ${
          overallStatus === 'operational' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' : 'bg-amber-900/40 text-amber-300 border border-amber-700'
        }`}>
          <span className={`w-2 h-2 rounded-full ${overallStatus === 'operational' ? 'bg-emerald-400' : 'bg-amber-400 motion-safe:animate-pulse'}`} />
          {overallStatus === 'operational' ? t('operational') : t('degraded')}
        </div>

        {active && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">⚠</span>
              <div>
                <p className="font-semibold text-amber-300">{active.title}</p>
                {active.description && <p className="text-amber-200/80 text-sm mt-1">{active.description}</p>}
                <p className="text-amber-400/70 text-xs mt-2">
                  {t('startedAt', { date: new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(active.startedAt * 1000)) })}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">{t('uptime90d')}</h2>
            <span className="text-emerald-400 text-sm font-mono">{avg90Uptime}%</span>
          </div>
          <UptimeGrid rollup={rollup} />
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-600 rounded-sm inline-block" aria-hidden="true" />≥99.5%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-600 rounded-sm inline-block" aria-hidden="true" />95-99.5%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-700 rounded-sm inline-block" aria-hidden="true" />&lt;95%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-muted rounded-sm inline-block" aria-hidden="true" />{t('noData')}</span>
          </div>
        </div>

        {resolved.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-4">{t('pastIncidents')}</h2>
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
