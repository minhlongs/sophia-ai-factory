/**
 * Agency Onboarding Step and Submission Validator Service
 *
 * Layer: tree (Pure domain logic)
 * @module tree/agency/validator/onboarding-validator-service
 */

import type {
  SeedAgentDeploymentConfig,
  AgencyOnboardingSubmission,
  ValidationResult,
} from './types';
import {
  validateBrandingStep,
  validateDomainStep,
  validateProfileStep,
  validateSeedAgentConfig,
} from './step-validators';

export {
  validateBrandingStep,
  validateDomainStep,
  validateProfileStep,
  validateSeedAgentConfig,
};

/**
 * Validates step 4: Seed Agents.
 */
export function validateSeedAgentsStep(seedAgents: SeedAgentDeploymentConfig[]): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(seedAgents) || seedAgents.length === 0) {
    errors.push('SEED_AGENTS_REQUIRED');
    return { valid: false, errors };
  }

  const enabledAgents = seedAgents.filter((a) => a.enabled);
  if (enabledAgents.length === 0) {
    errors.push('AT_LEAST_ONE_AGENT_REQUIRED');
  }

  for (const agent of enabledAgents) {
    const res = validateSeedAgentConfig(agent);
    if (!res.valid) {
      errors.push(...res.errors.map((err) => `${agent.agentId}:${err}`));
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates complete onboarding submission payload.
 */
export function validateCompleteSubmission(submission: AgencyOnboardingSubmission): {
  valid: boolean;
  stepErrors: Partial<Record<'profile' | 'branding' | 'domain' | 'seedAgents', string[]>>;
} {
  const stepErrors: Partial<Record<'profile' | 'branding' | 'domain' | 'seedAgents', string[]>> = {};

  const profileRes = validateProfileStep(submission.profile);
  if (!profileRes.valid) {
    stepErrors.profile = profileRes.errors;
  }

  const brandingRes = validateBrandingStep(submission.branding);
  if (!brandingRes.valid) {
    stepErrors.branding = brandingRes.errors;
  }

  const domainRes = validateDomainStep(submission.domain);
  if (!domainRes.valid) {
    stepErrors.domain = domainRes.errors;
  }

  const agentsRes = validateSeedAgentsStep(submission.seedAgents);
  if (!agentsRes.valid) {
    stepErrors.seedAgents = agentsRes.errors;
  }

  const valid = Object.keys(stepErrors).length === 0;
  return { valid, stepErrors };
}
