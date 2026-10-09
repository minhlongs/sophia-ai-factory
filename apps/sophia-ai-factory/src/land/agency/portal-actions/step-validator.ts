/**
 * Step-by-Step Onboarding Wizard Validation Action
 *
 * Layer: land/agency
 *
 * @module land/agency/portal-actions/step-validator
 */

'use server';

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
import type { StepValidationResult } from './common';

/**
 * Validates step-by-step inputs for the 5-step onboarding wizard.
 */
export async function validateOnboardingStepAction(
  step: AgencyOnboardingStep,
  payload: unknown
): Promise<StepValidationResult> {
  switch (step) {
    case 1:
      return validateProfileStep(payload as AgencyProfileInput);
    case 2:
      return validateBrandingStep(payload as AgencyBrandingInput);
    case 3:
      return validateDomainStep(payload as AgencyDomainInput);
    case 4:
      return validateSeedAgentsStep(payload as SeedAgentDeploymentConfig[]);
    case 5:
      return { valid: true, errors: [] };
    default:
      return { valid: false, errors: ['INVALID_STEP'] };
  }
}
