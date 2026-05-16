'use client';

/**
 * Experiments Widget — Client component for the experiments dashboard.
 *
 * Displays:
 * - Active experiments (running A vs B)
 * - Decided experiments (winner picked with CTR delta)
 * - Empty state when no experiments exist
 *
 * Non-tech CEO language: plain, no jargon.
 *
 * @module app/[locale]/dashboard/experiments/experiments-widget
 */

import { useTranslations } from 'next-intl';
import type { AbExperiment } from '@/forest/ab/ab-types';

interface Props {
  experiments: AbExperiment[];
}

export function ExperimentsWidget({ experiments }: Props) {
  const t = useTranslations('experiments');

  if (experiments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        <p className="text-lg font-medium">{t('empty.title')}</p>
        <p className="mt-1 text-sm">{t('empty.description')}</p>
      </div>
    );
  }

  const active = experiments.filter((e) => e.status === 'active');
  const decided = experiments.filter((e) => e.status === 'decided');

  return (
    <div className="space-y-8">
      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('sections.active')}</h2>
          <div className="space-y-3">
            {active.map((exp) => (
              <ExperimentCard key={exp.id} experiment={exp} />
            ))}
          </div>
        </section>
      )}

      {decided.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('sections.decided')}</h2>
          <div className="space-y-3">
            {decided.map((exp) => (
              <ExperimentCard key={exp.id} experiment={exp} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExperimentCard
// ---------------------------------------------------------------------------

interface CardProps {
  experiment: AbExperiment;
}

function computeCtrPct(conversions: number, impressions: number): string {
  if (impressions === 0) return '0%';
  return `${((conversions / impressions) * 100).toFixed(1)}%`;
}

function computeCtrDelta(exp: AbExperiment): string {
  if (exp.impressionsA === 0 || exp.impressionsB === 0) return '—';
  const ctrA = exp.conversionsA / exp.impressionsA;
  const ctrB = exp.conversionsB / exp.impressionsB;
  if (exp.winner === 'a' && ctrB > 0) {
    const pct = Math.round(((ctrA - ctrB) / ctrB) * 100);
    return `+${pct}%`;
  }
  if (exp.winner === 'b' && ctrA > 0) {
    const pct = Math.round(((ctrB - ctrA) / ctrA) * 100);
    return `+${pct}%`;
  }
  return '—';
}

function ExperimentCard({ experiment: exp }: CardProps) {
  const t = useTranslations('experiments');
  const delta = computeCtrDelta(exp);
  const winnerLabel =
    exp.winner === 'a'
      ? t('winner.a', { delta })
      : exp.winner === 'b'
        ? t('winner.b', { delta })
        : exp.winner === 'no_winner'
          ? t('winner.no_winner')
          : null;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={exp.status} winner={exp.winner} />
            <span className="text-xs text-muted-foreground font-mono">{exp.id.slice(0, 8)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-medium mb-1 flex items-center gap-1">
                {t('variant.a')}
                {exp.winner === 'a' && <span className="text-green-600">✓</span>}
              </p>
              <p className="text-muted-foreground leading-snug">{exp.variantACaption}</p>
              <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                <span>{exp.impressionsA} {t('stats.views')}</span>
                <span>{computeCtrPct(exp.conversionsA, exp.impressionsA)} CTR</span>
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-medium mb-1 flex items-center gap-1">
                {t('variant.b')}
                {exp.winner === 'b' && <span className="text-green-600">✓</span>}
              </p>
              <p className="text-muted-foreground leading-snug">{exp.variantBCaption}</p>
              <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                <span>{exp.impressionsB} {t('stats.views')}</span>
                <span>{computeCtrPct(exp.conversionsB, exp.impressionsB)} CTR</span>
              </div>
            </div>
          </div>

          {winnerLabel && (
            <p className="mt-3 text-sm font-medium text-green-700 dark:text-green-400">
              {winnerLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  winner,
}: {
  status: AbExperiment['status'];
  winner: AbExperiment['winner'];
}) {
  const t = useTranslations('experiments');
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
        {t('status.active')}
      </span>
    );
  }
  if (status === 'decided') {
    const isNoWinner = winner === 'no_winner';
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          isNoWinner
            ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
        }`}
      >
        {isNoWinner ? t('status.no_winner') : t('status.decided')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {t('status.expired')}
    </span>
  );
}
