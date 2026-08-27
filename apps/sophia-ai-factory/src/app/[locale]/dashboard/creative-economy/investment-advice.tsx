// i18n-namespace: creativeEconomy
/**
 * Investment Advice — ranked investment guidance combining ROI with
 * learning velocity. Each row shows the recommendation badge, composite
 * score, ROI, velocity, and explainable reason codes.
 */

import type { InvestmentAdviceRow } from '@/land/creative-economy/investment-advisor-math';

interface InvestmentAdviceProps {
  rows: InvestmentAdviceRow[];
  t: (key: string) => string;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function roiClass(roiPct: number | null): string {
  if (roiPct === null) return 'text-slate-400';
  return roiPct >= 0 ? 'text-emerald-600' : 'text-rose-600';
}

const RECOMMENDATION_BADGE: Record<string, string> = {
  scale_up: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  hold: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  cut_loss: 'bg-rose-50 text-rose-700 border-rose-200',
  insufficient_data: 'bg-slate-50 text-slate-600 border-slate-200',
};

export function InvestmentAdvice({ rows, t }: InvestmentAdviceProps) {
  return (
    <section className="mt-6" aria-labelledby="investment-heading">
      <h2 id="investment-heading" className="text-lg font-semibold text-[hsl(240,12%,12%)]">
        {t('investmentTitle')}
      </h2>
      <p className="mt-1 text-sm text-[hsl(240,12%,45%)]">{t('investmentDescription')}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[hsl(240,12%,45%)]">{t('noInvestments')}</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-[hsl(35,30%,90%)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[hsl(35,30%,95%)] text-[hsl(240,12%,12%)]">
              <tr>
                <th className="px-4 py-2 font-medium">{t('assetId')}</th>
                <th className="px-4 py-2 font-medium">{t('channel')}</th>
                <th className="px-4 py-2 font-medium">{t('compositeScore')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('revenue')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('cost')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('roiPercent')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('velocityScore')}</th>
                <th className="px-4 py-2 font-medium">{t('reasonsLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.entityType}:${r.entityId}:${r.channel}`} className="border-t border-[hsl(35,30%,90%)]">
                  <td className="max-w-[180px] truncate px-4 py-2 font-medium" title={r.entityId}>
                    {r.entityId}
                  </td>
                  <td className="px-4 py-2">{r.channel}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${RECOMMENDATION_BADGE[r.recommendation] ?? RECOMMENDATION_BADGE.insufficient_data}`}
                    >
                      {t(`recommendation_${r.recommendation}`)}
                    </span>
                    <span className="ml-2 text-xs tabular-nums text-[hsl(240,12%,45%)]">
                      {r.compositeScore}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">{formatCents(r.revenueCents)}</td>
                  <td className="px-4 py-2 text-right">{formatCents(r.costCents)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${roiClass(r.roiPct)}`}>
                    {r.roiPct === null ? '—' : `${r.roiPct.toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.velocityScore === null ? '—' : Math.round(r.velocityScore)}
                  </td>
                  <td className="px-4 py-2 text-xs text-[hsl(240,12%,45%)]">
                    {r.reasons.map((reason) => t(`reason_${reason}`)).join(', ')}
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
