/**
 * Individual Step Validators for Agency Onboarding
 *
 * Layer: tree (Pure domain logic)
 * @module tree/agency/validator/step-validators
 */

import type {
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
  ValidationResult,
} from './types';
import {
  EMAIL_REGEX,
  HEX_COLOR_REGEX,
  VALID_AUTONOMY_LEVELS,
  VALID_ESCALATION_ACTIONS,
} from './types';
import {
  validateAgencySlug,
  validateCustomDomain,
} from './checklist-validator';

/**
 * Validates seed agent deployment configuration.
 */
export function validateSeedAgentConfig(config: SeedAgentDeploymentConfig): ValidationResult {
  const errors: string[] = [];

  if (!config.agentId || typeof config.agentId !== 'string' || config.agentId.trim() === '') {
    errors.push('AGENT_ID_REQUIRED');
  }
  if (!config.name || typeof config.name !== 'string' || config.name.trim() === '') {
    errors.push('AGENT_NAME_REQUIRED');
  }
  if (!VALID_AUTONOMY_LEVELS.has(config.maxAutonomy)) {
    errors.push('INVALID_AUTONOMY_LEVEL');
  }
  if (!Number.isFinite(config.maxComputeUnitsMcu) || config.maxComputeUnitsMcu <= 0) {
    errors.push('INVALID_COMPUTE_UNITS');
  }
  if (!VALID_ESCALATION_ACTIONS.has(config.escalationPolicy)) {
    errors.push('INVALID_ESCALATION_POLICY');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates step 1: Profile.
 */
export function validateProfileStep(profile: AgencyProfileInput): ValidationResult {
  const errors: string[] = [];

  if (!profile.clientName || profile.clientName.trim() === '') {
    errors.push('CLIENT_NAME_REQUIRED');
  }
  if (!profile.contactEmail || !EMAIL_REGEX.test(profile.contactEmail.trim())) {
    errors.push('CONTACT_EMAIL_INVALID');
  }
  if (!Number.isFinite(profile.initialMcuBudget) || profile.initialMcuBudget < 0) {
    errors.push('INITIAL_MCU_INVALID');
  }

  const slugValidation = validateAgencySlug(profile.agencySlug);
  if (!slugValidation.valid) {
    errors.push(...slugValidation.errors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates step 2: Branding.
 */
export function validateBrandingStep(branding?: AgencyBrandingInput | null): ValidationResult {
  if (!branding) {
    return { valid: true, errors: [] };
  }
  const errors: string[] = [];

  if (branding.primaryColor && !HEX_COLOR_REGEX.test(branding.primaryColor.trim())) {
    errors.push('PRIMARY_COLOR_INVALID');
  }
  if (branding.accentColor && !HEX_COLOR_REGEX.test(branding.accentColor.trim())) {
    errors.push('ACCENT_COLOR_INVALID');
  }
  if (branding.logoUrl && branding.logoUrl.trim() !== '') {
    try {
      const parsed = new URL(branding.logoUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.push('LOGO_URL_INVALID_PROTOCOL');
      }
    } catch {
      errors.push('LOGO_URL_INVALID');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates step 3: Domain.
 */
export function validateDomainStep(domain?: AgencyDomainInput | null): ValidationResult {
  if (domain && domain.customDomain) {
    return validateCustomDomain(domain.customDomain);
  }
  return { valid: true, errors: [] };
}
