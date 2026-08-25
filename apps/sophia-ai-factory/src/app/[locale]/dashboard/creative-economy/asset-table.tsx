// i18n-namespace: creativeEconomy
/**
 * Asset Table — top assets by ROI from performance_events aggregation.
 */

import type { AssetPerformanceRow } from '@/land/creative-economy/types';

interface AssetTableProps {
  rows: AssetPerformanceRow[];
  t: (key: string) => string;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function roiClass(roiPct: number | null): string {
  if (roiPct === null) return 'text-slate-400';
  return roiPct >= 0 ? 'text-emerald-600' : 'text-rose-600';
}

export function AssetTable({ rows, t }: AssetTableProps) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-[hsl(240,12%,12%)]">{t('assetTitle')}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[hsl(240,12%,45%)]">{t('noAssets')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[hsl(35,30%,90%)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[hsl(35,30%,95%)] text-[hsl(240,12%,12%)]">
              <tr>
                <th className="px-4 py-2 font-medium">{t('assetId')}</th>
                <th className="px-4 py-2 font-medium">{t('channel')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('impressions')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('revenue')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('cost')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('roiPercent')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.assetId} className="border-t border-[hsl(35,30%,90%)]">
                  <td className="max-w-[180px] truncate px-4 py-2 font-medium" title={r.assetId}>
                    {r.assetId}
                  </td>
                  <td className="px-4 py-2">{r.channel}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.impressions.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">{formatCents(r.revenueCents)}</td>
                  <td className="px-4 py-2 text-right">{formatCents(r.costCents)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${roiClass(r.roiPct)}`}>
                    {r.roiPct === null ? '—' : `${r.roiPct.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
