/**
 * Agency Onboarding Wizard Types & Constants.
 *
 * Layer: forest/agency (Presentation & Client Component)
 *
 * @module forest/agency/onboarding-wizard/types
 */

import type {
  AgencyOnboardingSubmission,
  AgencyOnboardingResult,
  AgencyOnboardingStep,
  SeedAgentDeploymentConfig,
} from '@/seed/types';

export interface AgencyOnboardingWizardActions {
  validateStep?: (
    step: AgencyOnboardingStep,
    payload: unknown
  ) => Promise<{ valid: boolean; errors: string[] }>;
  submitOnboarding?: (
    submission: AgencyOnboardingSubmission
  ) => Promise<AgencyOnboardingResult>;
}

export interface AgencyOnboardingWizardProps {
  agencyOrgId: string;
  locale?: 'en' | 'vi';
  initialSlug?: string;
  actions?: AgencyOnboardingWizardActions;
  onSuccess?: (result: AgencyOnboardingResult) => void;
}

export const DEFAULT_SEED_AGENTS: SeedAgentDeploymentConfig[] = [
  {
    agentId: 'agent_video_creator_v1',
    name: 'Video Creator Specialist',
    role: 'video_creator',
    template: 'ugc_video_generator_v1',
    maxAutonomy: 'L1',
    maxComputeUnitsMcu: 200,
    escalationPolicy: 'escalate_human',
    enabled: true,
  },
  {
    agentId: 'agent_ugc_reviewer_v1',
    name: 'Client Review Assistant',
    role: 'ugc_reviewer',
    template: 'review_collector_v1',
    maxAutonomy: 'L2',
    maxComputeUnitsMcu: 150,
    escalationPolicy: 'request_approval',
    enabled: true,
  },
  {
    agentId: 'agent_sales_outreach_v1',
    name: 'Engagement & Outreach Bot',
    role: 'sales_outreach',
    template: 'client_notifier_v1',
    maxAutonomy: 'L3',
    maxComputeUnitsMcu: 150,
    escalationPolicy: 'escalate_human',
    enabled: true,
  },
];
