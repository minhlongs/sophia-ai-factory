/**
 * Agency Onboarding Wizard Step Validation Helper.
 *
 * Layer: forest/agency (Presentation & Client Component)
 *
 * @module forest/agency/onboarding-wizard/validate-wizard-step
 */

import type {
  AgencyOnboardingStep,
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
} from '@/seed/types';
import {
  validateProfileStep,
  validateBrandingStep,
  validateDomainStep,
  validateSeedAgentsStep,
} from '@/tree/agency/onboarding-validator';
import type { AgencyOnboardingWizardActions } from './types';

interface ValidateStepParams {
  currentStep: AgencyOnboardingStep;
  profile: AgencyProfileInput;
  branding: AgencyBrandingInput;
  domain: AgencyDomainInput;
  seedAgents: SeedAgentDeploymentConfig[];
  actions?: AgencyOnboardingWizardActions;
}

export async function runStepValidation({
  currentStep,
  profile,
  branding,
  domain,
  seedAgents,
  actions,
}: ValidateStepParams): Promise<{ valid: boolean; errors: string[] }> {
  let payload: unknown;
  if (currentStep === 1) payload = profile;
  else if (currentStep === 2) payload = branding;
  else if (currentStep === 3) payload = domain;
  else if (currentStep === 4) payload = seedAgents;
  else payload = {};

  if (actions?.validateStep) {
    return actions.validateStep(currentStep, payload);
  }

  if (currentStep === 1) return validateProfileStep(payload as AgencyProfileInput);
  if (currentStep === 2) return validateBrandingStep(payload as AgencyBrandingInput);
  if (currentStep === 3) return validateDomainStep(payload as AgencyDomainInput);
  if (currentStep === 4) {
    return validateSeedAgentsStep(payload as SeedAgentDeploymentConfig[]);
  }

  return { valid: true, errors: [] };
}
