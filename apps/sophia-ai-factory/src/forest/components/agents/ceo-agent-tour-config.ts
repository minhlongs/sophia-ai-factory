/**
 * CEO Agent Onboarding Tour — step configuration.
 *
 * 4-step tour introducing PREMIUM+ users to the AI Executive Board.
 * Steps: Chat, Briefing, Campaigns, Revenue.
 * Static data — no React dependency.
 */

export interface CeoAgentStepConfig {
  stepNumber: number;
  /** i18n key under 'dashboard.agents.onboarding_tour' */
  titleKey: string;
  /** i18n key for description */
  descKey: string;
}

export const CEO_AGENT_TOUR_STORAGE_KEY = 'sophia_ceo_agent_tour_dismissed';

export const CEO_AGENT_TOTAL_STEPS = 4;

export const CEO_AGENT_TOUR_STEPS: CeoAgentStepConfig[] = [
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
