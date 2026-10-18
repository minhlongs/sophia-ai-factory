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
import type { FunnelStepData, FunnelGroup, FunnelDashboard } from '@/seed/types/analytics-funnel';
import { buildSteps, fetchCampaignLifecycleSteps } from './funnel-dashboard-helpers';

// Re-export shared types
export type { FunnelStepData, FunnelGroup, FunnelDashboard };

export interface CampaignStatusCount {
  status: string;
  count: number;
}

export interface CheckoutSignal {
  started: number;
  success: number;
}

/**
 * Build funnel groups from raw activation data + campaign + checkout queries.
 */
export async function getFunnelDashboard(
  fromTs: number,
  toTs: number,
): Promise<FunnelDashboard> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const activation: ActivationFunnel = await getActivationFunnel(fromTs, toTs);

  const funnelActivation = buildSteps([
    { key: 'signups', name: 'Signed Up', count: activation.signups },
    { key: 'first_login', name: 'First Login', count: activation.firstLogin },
    { key: 'first_video', name: 'First Video', count: activation.firstVideo },
    { key: 'first_conversion', name: 'First Conversion', count: activation.firstConversion },
  ]);

  const funnelOnboarding = buildSteps([
    { key: 'signups', name: 'Signed Up', count: activation.signups },
    { key: 'first_login', name: 'First Login', count: activation.firstLogin },
    { key: 'first_video', name: 'First Video', count: activation.firstVideo },
  ]);

  const funnelVideoPaid = buildSteps([
    { key: 'first_video', name: 'Created a Video', count: activation.firstVideo },
    { key: 'first_conversion', name: 'First Conversion (Paid)', count: activation.firstConversion },
  ]);

  const funnelCampaign = await fetchCampaignLifecycleSteps(db, fromTs, toTs);

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
