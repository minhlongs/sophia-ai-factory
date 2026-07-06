/**
 * CEO Agent Dashboard Onboarding — tour step configuration.
 *
 * 4-step tour introducing PREMIUM+ users to the CEO Agent dashboard at
 * `/dashboard/ceo-agent` (Briefing, Campaigns, Revenue, Chat).
 * Static data — no React dependency.
 */

export interface CeoAgentStepConfig {
  stepNumber: number;
  /** i18n key under `dashboard.ceoAgent.onboarding_tour` */
  titleKey: string;
  /** i18n key for description */
  descKey: string;
}

export const CEO_DASHBOARD_TOUR_STORAGE_KEY = 'sophia_ceo_dashboard_tour_dismissed';

export const CEO_DASHBOARD_TOUR_TOTAL_STEPS = 4;

export const CEO_DASHBOARD_TOUR_STEPS: CeoAgentStepConfig[] = [
  {
    stepNumber: 1,
    titleKey: 'tour_step1_title',
    descKey: 'tour_step1_desc',
  },
  {
    stepNumber: 2,
    titleKey: 'tour_step2_title',
    descKey: 'tour_step2_desc',
  },
  {
    stepNumber: 3,
    titleKey: 'tour_step3_title',
    descKey: 'tour_step3_desc',
  },
  {
    stepNumber: 4,
    titleKey: 'tour_step4_title',
    descKey: 'tour_step4_desc',
  },
];
