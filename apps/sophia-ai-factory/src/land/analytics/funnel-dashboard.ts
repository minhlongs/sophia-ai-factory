/**
 * Funnel dashboard queries.
 *
 * Aggregates 4 conversion funnels for the user-facing analytics dashboard:
 *   1. Landing/Signup (activation) — signup → login → first video → conversion
 *   2. Onboarding — signup → login → first video
 *   3. Video→Paid — first video → first conversion (+ checkout signals)
 *   4. Campaign lifecycle — campaigns grouped by status
 *
 * @module land/analytics/funnel-dashboard
 */

import { getD1 } from '@/seed/db/client';
import { getActivationFunnel, type ActivationFunnel } from './funnel-stats';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FunnelStepData {
  name: string;
  key: string;
  count: number;
  /** Percentage drop-off from the previous step (null for first step). */
  dropOffRate: number | null;
  /** Percentage of users retained since the first step. */
  conversionRate: number;
}

export interface FunnelGroup {
  id: string;
  title: string;
  description: string;
  steps: FunnelStepData[];
}

export interface FunnelDashboard {
  fromTs: number;
  toTs: number;
  funnels: FunnelGroup[];
}

export interface CampaignStatusCount {
  status: string;
  count: number;
}

export interface CheckoutSignal {
  started: number;
  success: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

function buildSteps(
  data: Array<{ key: string; name: string; count: number }>,
): FunnelStepData[] {
  return data.map((d, i) => {
    const firstCount = data[0].count;
    const prevCount = i > 0 ? data[i - 1].count : firstCount;
    return {
      name: d.name,
      key: d.key,
      count: d.count,
      dropOffRate: i > 0 ? (1 - safeDiv(d.count, prevCount)) * 100 : null,
      conversionRate: safeDiv(d.count, firstCount) * 100,
    };
  });
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Build funnel groups from raw activation data + campaign + checkout queries.
 */
export async function getFunnelDashboard(
  fromTs: number,
  toTs: number,
): Promise<FunnelDashboard> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');

  const activation: ActivationFunnel = await getActivationFunnel(fromTs, toTs);

  // ── Funnel 1: Landing→Signup (Activation) ──
  const funnelActivation = buildSteps([
    { key: 'signups', name: 'Signed Up', count: activation.signups },
    { key: 'first_login', name: 'First Login', count: activation.firstLogin },
    { key: 'first_video', name: 'First Video', count: activation.firstVideo },
    { key: 'first_conversion', name: 'First Conversion', count: activation.firstConversion },
  ]);

  // ── Funnel 2: Onboarding→First Video ──
  const funnelOnboarding = buildSteps([
    { key: 'signups', name: 'Signed Up', count: activation.signups },
    { key: 'first_login', name: 'First Login', count: activation.firstLogin },
    { key: 'first_video', name: 'First Video', count: activation.firstVideo },
  ]);

  // ── Funnel 3: Video→Paid ──
  // User-owning: counts users who had a video and later converted
  const funnelVideoPaid = buildSteps([
    { key: 'first_video', name: 'Created a Video', count: activation.firstVideo },
    { key: 'first_conversion', name: 'First Conversion (Paid)', count: activation.firstConversion },
  ]);

  // ── Funnel 4: Campaign Lifecycle ──
  const fromIso = new Date(fromTs * 1000).toISOString();
  const toIso = new Date(toTs * 1000).toISOString();

  const campaignRows = await db
    .prepare(
      `SELECT status, COUNT(*) AS cnt
       FROM campaigns
       WHERE datetime(created_at) >= datetime(?1)
         AND datetime(created_at) <= datetime(?2)
       GROUP BY status
       ORDER BY cnt DESC`,
    )
    .bind(fromIso, toIso)
    .all<{ status: string; cnt: number }>();

  const statusMap: Record<string, number> = {};
  for (const r of campaignRows.results ?? []) {
    statusMap[r.status] = Number(r.cnt);
  }

  const statusOrder = ['draft', 'queued', 'processing_script', 'processing_video', 'completed', 'failed'];
  const funnelCampaignSteps = statusOrder
    .filter((s) => (statusMap[s] ?? 0) > 0)
    .map((s) => ({
      key: s,
      name: formatStatus(s),
      count: statusMap[s] ?? 0,
    }));

  const funnelCampaign = buildSteps(
    funnelCampaignSteps.length > 0
      ? funnelCampaignSteps
      : [{ key: 'no_campaigns', name: 'No Campaigns', count: 0 }],
  );

  return {
    fromTs,
    toTs,
    funnels: [
      {
        id: 'activation',
        title: 'Landing → Conversion',
        description: 'Users who signed up and progressed through key milestones in their journey.',
        steps: funnelActivation,
      },
      {
        id: 'onboarding',
        title: 'Onboarding → First Video',
        description: 'Users who completed onboarding and generated their first AI video.',
        steps: funnelOnboarding,
      },
      {
        id: 'video_to_paid',
        title: 'Video → Paid Conversion',
        description: 'Users who created a video and later made a purchase or conversion.',
        steps: funnelVideoPaid,
      },
      {
        id: 'campaign_lifecycle',
        title: 'Campaign Lifecycle',
        description: 'Campaign status distribution — how far campaigns progress through the pipeline.',
        steps: funnelCampaign,
      },
    ],
  };
}

// ── Status display helpers ────────────────────────────────────────────────────

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    queued: 'Queued',
    processing_script: 'Writing Script',
    processing_video: 'Rendering Video',
    completed: 'Completed',
    failed: 'Failed',
  };
  return labels[status] ?? status;
}
