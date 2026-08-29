// i18n-namespace: realityLoop
/**
 * Insight Panels — internal product-learning dashboard (Phase J).
 *
 * Renders every Reality Loop insight: mission funnel, creative acceptance,
 * human corrections, agent failure taxonomy, mission cost, memory usage,
 * economic outcomes (em-dash for null), and Phase E feedback aggregates.
 */

import { type RealityLoopInsights } from '@/land/reality-loop/insights';

type TFn = (key: string, values?: Record<string, string | number | Date>) => string;

function rate(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function cents(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD' }).format(value / 100);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </section>
  );
}

export function InsightPanels({ insights, t }: { insights: RealityLoopInsights; t: TFn }) {
  const { feedback } = insights;

  return (
    <div>
      {/* Mission funnel */}
      <Section title={t('funnelTitle')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={t('created')} value={insights.missionsCreated.toLocaleString()} />
          <StatCard label={t('completed')} value={insights.missionsCompleted.toLocaleString()} />
          <StatCard label={t('completionRate')} value={rate(insights.completionRate)} />
          <StatCard label={t('acceptanceRate')} value={rate(insights.acceptanceRate)} />
        </div>
      </Section>

      {/* Creative decisions (Q3) */}
      <Section title={t('creativeTitle')}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          <StatCard label={t('accepted')} value={insights.creativeAccepted.toLocaleString()} />
          <StatCard label={t('rejected')} value={insights.creativeRejected.toLocaleString()} />
          <StatCard label={t('acceptanceRate')} value={rate(insights.acceptanceRate)} />
          <StatCard label={t('corrections')} value={insights.humanCorrections.toLocaleString()} />
        </div>
      </Section>

      {/* Autonomy failures (Q7) */}
      <Section title={t('failuresTitle')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={t('failureTotal')} value={insights.agentFailureTotal.toLocaleString()} />
          {insights.agentFailures.slice(0, 3).map((f) => (
            <StatCard key={f.failureClass} label={f.failureClass} value={f.count.toLocaleString()} />
          ))}
          {insights.agentFailures.length > 3 && (
            <StatCard label={t('otherFailures')} value={(insights.agentFailureTotal - insights.agentFailures.slice(0, 3).reduce((s, f) => s + f.count, 0)).toLocaleString()} />
          )}
        </div>
      </Section>

      {/* Economics (Q4, Phase H) */}
      <Section title={t('economicsTitle')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={t('missionCost')} value={cents(insights.missionCostCents)} />
          <StatCard label={t('revenue')} value={cents(insights.economic.revenueCents)} />
          <StatCard label={t('cost')} value={cents(insights.economic.costCents)} />
          <StatCard label={t('net')} value={cents(insights.economic.netCents)} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {t('roi')}:{' '}
          <span className="font-medium text-slate-700">
            {insights.economic.roiPct === null ? '—' : `${insights.economic.roiPct.toFixed(1)}%`}
          </span>
        </p>
      </Section>

      {/* Memory (Q5) */}
      <Section title={t('memoryTitle')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label={t('memoryUsed')} value={insights.memory.used.toLocaleString()} />
          <StatCard label={t('memoryCorrected')} value={insights.memory.corrected.toLocaleString()} />
          <StatCard label={t('correctionRate')} value={rate(insights.memory.correctionRate)} />
        </div>
      </Section>

      {/* Feedback aggregates (Phase E) */}
      {feedback && (
        <Section title={t('feedbackTitle')}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={t('feedbackTotal')} value={feedback.total.toLocaleString()} />
            <StatCard label={t('usefulYes')} value={feedback.usefulYes.toLocaleString()} />
            <StatCard label={t('usefulNo')} value={feedback.usefulNo.toLocaleString()} />
            <StatCard
              label={t('topReason')}
              value={feedback.topReasons[0]?.reason ?? '—'}
            />
          </div>
        </Section>
      )}
    </div>
  );
}