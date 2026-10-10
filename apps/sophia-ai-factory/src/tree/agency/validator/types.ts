/**
 * Agency Onboarding Validator Types and Constants
 *
 * Layer: tree (Pure domain logic)
 * @module tree/agency/validator/types
 */

import type {
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
  AgencyOnboardingSubmission,
  AgyAutonomyLevel,
  EscalationAction,
} from '@/seed/types';

export type {
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
  AgencyOnboardingSubmission,
  AgyAutonomyLevel,
  EscalationAction,
};

export const RESERVED_SLUGS = new Set([
  'sophia',
  'api',
  'admin',
  'portal',
  'sub',
  'system',
  'app',
  'auth',
  'partner',
  'agency',
  'dashboard',
  'login',
  'register',
  'billing',
  'webhook',
  'status',
]);

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const VALID_AUTONOMY_LEVELS = new Set<AgyAutonomyLevel>(['L0', 'L1', 'L2', 'L3', 'L4'] as const);
export const VALID_ESCALATION_ACTIONS = new Set<EscalationAction>([
  'halt',
  'request_approval',
  'escalate_human',
  'degrade_gracefully',
]);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
