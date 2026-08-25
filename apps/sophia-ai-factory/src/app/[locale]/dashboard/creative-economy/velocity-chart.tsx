// i18n-namespace: creativeEconomy
/**
 * Velocity Chart — learning velocity scores per entity/channel combo.
 * Pure CSS bars (no chart library) — score is 0..100.
 */

import type { VelocityPoint } from '@/land/creative-economy/types';

interface VelocityChartProps {
  points: VelocityPoint[];
  t: (key: string) => string;
}

function scoreColor(score: number): string {
  if (score >= 60) return 'bg-emerald-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

export function VelocityChart({ points, t }: VelocityChartProps) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-[hsl(240,12%,12%)]">{t('velocityTitle')}</h2>
      {points.length === 0 ? (
        <p className="text-sm text-[hsl(240,12%,45%)]">{t('noVelocity')}</p>
      ) : (
        <ul className="space-y-3 rounded-lg border border-[hsl(35,30%,90%)] p-4">
          {points.map((p) => (
            <li key={`${p.entityType}-${p.channel}`}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium text-[hsl(240,12%,12%)]">
                  {p.entityType}
                  <span className="ml-1 text-xs text-[hsl(240,12%,45%)]">({p.channel})</span>
                </span>
                <span className="whitespace-nowrap text-xs text-[hsl(240,12%,45%)]">
                  {t('scoreLabel')}: {p.velocityScore.toFixed(0)} · {p.eventCount}{' '}
                  {t('eventsLabel')}
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={Math.round(p.velocityScore)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${p.entityType} ${p.channel}`}
              >
                <div
                  className={`h-full rounded-full ${scoreColor(p.velocityScore)}`}
                  style={{ width: `${Math.max(2, Math.min(100, p.velocityScore))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
