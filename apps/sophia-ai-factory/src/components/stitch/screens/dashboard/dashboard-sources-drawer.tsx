/**
 * Dashboard Sources Trace Drawer (`claude-dashboard` Sources Pattern)
 *
 * Implements the `jimliu/baoyu-design` (`claude-dashboard`) Sources panel in
 * clean-room React: traces every KPI on the Sophia Control Deck directly to
 * its verified Cloudflare D1 table, SQL column expression, cryptographic proof,
 * and current `DataTruthState`.
 *
 * @module components/stitch/screens/dashboard/dashboard-sources-drawer
 */

// i18n-namespace: stitch.dashboard
'use client';

import React, { useState } from 'react';
import { Database, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { SOPHIA_DASHBOARD_SOURCE_TRACES } from '@/seed/baoyu-design';
import type { DataTruthState } from '@/components/stitch/ui/data-state-boundary';

export interface DashboardSourcesDrawerProps {
  t: (key: string) => string;
  dataTruthState?: DataTruthState;
  isVi?: boolean;
}

export function DashboardSourcesDrawer({
  t,
  dataTruthState = 'live',
  isVi = true,
}: DashboardSourcesDrawerProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div
      data-testid="dashboard-sources-drawer"
      className="v3-core rounded-2xl border border-border bg-card p-4 transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-amber-800 dark:text-amber-300">
              {t('sourcesDrawer.eyebrow')}
            </p>
            <h2 className="text-sm font-bold text-foreground dark:text-white">
              {t('sourcesDrawer.title')}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            data-testid="dashboard-sources-truth-state"
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 font-mono text-[11px] text-emerald-700 dark:text-emerald-300"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              {t('sourcesDrawer.stateLabel')}: {dataTruthState.toUpperCase()}
            </span>
          </span>

          <button
            type="button"
            data-testid="dashboard-sources-toggle"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((prev) => !prev)}
            className="btn btn-ghost !h-8 !px-3 text-xs font-mono"
          >
            <span>{t('sourcesDrawer.toggleBtn')}</span>
            {isOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          data-testid="dashboard-sources-table"
          className="mt-4 pt-4 border-t border-border space-y-3"
        >
          <p className="text-xs text-muted-foreground">
            {t('sourcesDrawer.subtitle')}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border dark:border-white/10 font-mono text-[11px] text-muted-foreground">
                  <th scope="col" className="py-2 pr-4">{t('sourcesDrawer.tableColMetric')}</th>
                  <th scope="col" className="py-2 pr-4">{t('sourcesDrawer.tableColSource')}</th>
                  <th scope="col" className="py-2">{t('sourcesDrawer.tableColProof')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 dark:divide-white/5">
                {SOPHIA_DASHBOARD_SOURCE_TRACES.map((row) => (
                  <tr key={row.id} data-testid={`dashboard-source-row-${row.id}`}>
                    <td className="py-2.5 pr-4 font-semibold text-foreground dark:text-white">
                      {isVi ? row.metricLabelVi : row.metricLabelEn}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[11px] text-indigo-700 dark:text-indigo-300">
                      <div>{row.d1Table}</div>
                      <div className="text-muted-foreground text-[10px]">
                        {row.queryColumn}
                      </div>
                    </td>
                    <td className="py-2.5 font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
                      <div>{row.verificationMechanism}</div>
                      <div className="text-muted-foreground text-[10px]">
                        {row.platformFeePolicy}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
