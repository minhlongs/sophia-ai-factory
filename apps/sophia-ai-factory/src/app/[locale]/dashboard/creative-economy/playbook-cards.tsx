// i18n-namespace: creativeEconomy
/**
 * Playbook Cards — auto-apply playbook health per installation.
 */

import type { PlaybookHealthRow } from '@/land/creative-economy/types';

interface PlaybookCardsProps {
  rows: PlaybookHealthRow[];
  t: (key: string) => string;
}

const STATUS_STYLES: Record<PlaybookHealthRow['status'], string> = {
  healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  at_risk: 'bg-amber-50 text-amber-700 border-amber-200',
  rolled_back: 'bg-rose-50 text-rose-700 border-rose-200',
};

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

export function PlaybookCards({ rows, t }: PlaybookCardsProps) {
  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-700">{t('playbookTitle')}</h3>
        <p className="mt-2 text-sm text-slate-500">{t('noPlaybooks')}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-700">{t('playbookTitle')}</h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.installationId}
            className={`rounded-lg border p-3 ${STATUS_STYLES[r.status]}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-xs opacity-80" title={r.ruleId}>
                {r.ruleId || r.installationId}
              </span>
              <span className="whitespace-nowrap rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold">
                {t(`status_${r.status}`)}
              </span>
            </div>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="opacity-75">{t('recentFailureRate')}</dt>
                <dd className="font-semibold tabular-nums">{formatRate(r.recentFailureRate)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="opacity-75">{t('baselineFailureRate')}</dt>
                <dd className="tabular-nums">{formatRate(r.baselineFailureRate)}</dd>
              </div>
              {r.lastRollbackAtSec !== null && (
                <div className="flex justify-between gap-2">
                  <dt className="opacity-75">{t('lastRollback')}</dt>
                  <dd>{new Date(r.lastRollbackAtSec * 1000).toLocaleDateString()}</dd>
                </div>
              )}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
