/**
 * Central registry for all A/B experiments.
 *
 * Add new experiments here. PostHog feature flag `name` MUST match `name` field.
 * Owner agent (CMO/CSO/CTO/COO) is accountable for the experiment hypothesis + analysis.
 *
 * Usage in server component:
 *   import { ExperimentVariant } from '@/components/experiment-variant'
 *   import { getExperiment } from '@/land/signals/experiments-registry'
 *
 *   const exp = getExperiment('hero-cta-copy-v1')
 *   <ExperimentVariant experimentName={exp.name} distinctId={userId}>
 *     {variant === 'control' ? <ControlButton /> : <TreatmentButton />}
 *   </ExperimentVariant>
 *
 * RED-TEAM #11: experiments here are CLIENT-VISIBLE. Critical events
 * (tier_upgraded etc.) are server-only — A/B affects display only, never
 * money flow.
 */

export interface ExperimentDefinition {
  name: string;
  description: string;
  hypothesis: string;
  variants: readonly string[]; // first MUST be 'control'
  startedAt: string; // ISO date
  endsAt?: string; // ISO date — undefined = open-ended
  ownerAgent: 'CMO' | 'CSO' | 'CTO' | 'COO';
  metric: string; // primary KPI (e.g., 'signup_conversion')
  trafficSplit?: Record<string, number>; // optional override; default = even split
}

export const EXPERIMENTS: readonly ExperimentDefinition[] = [
  {
    name: 'hero-cta-copy-v1',
    description: 'Hero CTA copy variation on landing page',
    hypothesis: 'Specific value-prop CTA ("Tạo video AI miễn phí ngay") converts better than generic ("Bắt đầu miễn phí")',
    variants: ['control', 'specific-cta'],
    startedAt: '2026-04-17',
    ownerAgent: 'CMO',
    metric: 'signup_conversion',
  },
  {
    name: 'pricing-tier-order-v1',
    description: 'Pricing tier display order (BASIC-first vs PREMIUM-first)',
    hypothesis: 'Anchoring with PREMIUM first lifts ARPU vs BASIC-first',
    variants: ['control', 'premium-first'],
    startedAt: '2026-04-17',
    ownerAgent: 'CSO',
    metric: 'tier_upgraded_to_premium_or_above',
  },
];

export function getExperiment(name: string): ExperimentDefinition | undefined {
  return EXPERIMENTS.find((e) => e.name === name);
}

export function listExperiments(): readonly ExperimentDefinition[] {
  return EXPERIMENTS;
}

/** Returns active experiments (not past endsAt) — for dashboard listing */
export function getActiveExperiments(now: Date = new Date()): readonly ExperimentDefinition[] {
  const nowISO = now.toISOString().slice(0, 10);
  return EXPERIMENTS.filter((e) => !e.endsAt || e.endsAt > nowISO);
}
