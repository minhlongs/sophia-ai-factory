/**
 * Onboarding tracker domain types and constants.
 * @module forest/onboarding/tracker/types
 */

export type OnboardingMilestone =
  | 'contract_signed'
  | 'welcome_email_sent'
  | 'kickoff_scheduled'
  | 'kickoff_completed'
  | 'discovery_completed'
  | 'channels_connected'
  | 'brand_assets_loaded'
  | 'first_post_published'
  | 'first_report_delivered'
  | 'team_trained'
  | 'retro_completed';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'at_risk' | 'completed' | 'paused';

export interface MilestoneRecord {
  milestone: OnboardingMilestone;
  achievedAt: string;
  achievedBy: string;
  notes?: string;
}

export interface OnboardingProgress {
  tenantId: string;
  status: OnboardingStatus;
  startedAt: string;
  completedAt?: string;
  milestones: MilestoneRecord[];
  currentPhase: number;
  daysElapsed: number;
  daysRemaining: number;
  atRiskFlags: string[];
}

export const MILESTONE_SEQUENCE: OnboardingMilestone[] = [
  'contract_signed',
  'welcome_email_sent',
  'kickoff_scheduled',
  'kickoff_completed',
  'discovery_completed',
  'channels_connected',
  'brand_assets_loaded',
  'first_post_published',
  'first_report_delivered',
  'team_trained',
  'retro_completed',
];

export const PHASE_MILESTONES: Record<number, OnboardingMilestone[]> = {
  1: ['contract_signed', 'welcome_email_sent', 'kickoff_scheduled', 'kickoff_completed', 'discovery_completed'],
  2: ['channels_connected', 'brand_assets_loaded'],
  3: ['first_post_published', 'first_report_delivered', 'team_trained', 'retro_completed'],
};
