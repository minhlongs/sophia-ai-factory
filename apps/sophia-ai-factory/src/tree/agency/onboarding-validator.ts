/**
 * Agency Onboarding Input Validator & Sanitizer
 *
 * Layer: tree (Pure domain logic — zero DB, zero network side effects)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * Responsibilities:
 * 1. validateAgencySlug: Validates format, length, and rejects reserved system subdomains
 * 2. validateHexColor: Validates #RRGGBB format with fallback protection
 * 3. validateCustomDomain: Validates FQDN format, blocks protocol prefixes and paths
 * 4. sanitizeCustomCss: Strips XSS attack vectors, script tags, CSS expressions, and unsafe protocols
 * 5. validateSeedAgentConfig: Validates autonomy levels, compute bounds, and escalation policies
 * 6. validateOnboardingStep: Validates individual step inputs for the 5-step wizard
 * 7. validateCompleteSubmission: Validates full onboarding payload prior to persistence
 *
 * @module tree/agency/onboarding-validator
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

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_AUTONOMY_LEVELS = new Set<AgyAutonomyLevel>(['L0', 'L1', 'L2', 'L3', 'L4'] as const);
const VALID_ESCALATION_ACTIONS = new Set<EscalationAction>([
  'halt',
  'request_approval',
  'escalate_human',
  'degrade_gracefully',
]);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates an agency slug string.
 */
export function validateAgencySlug(slug: string | null | undefined): ValidationResult {
  const errors: string[] = [];
  if (!slug || typeof slug !== 'string') {
    return { valid: false, errors: ['SLUG_REQUIRED'] };
  }

  const normalized = slug.trim().toLowerCase();
  if (normalized.length < 3) {
    errors.push('SLUG_TOO_SHORT');
  }
  if (normalized.length > 48) {
    errors.push('SLUG_TOO_LONG');
  }
  if (!SLUG_REGEX.test(normalized)) {
    errors.push('SLUG_INVALID_FORMAT');
  }
  if (RESERVED_SLUGS.has(normalized)) {
    errors.push('SLUG_RESERVED');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a color hex code (#RGB or #RRGGBB).
 */
export function validateHexColor(color: string | null | undefined, fallback = '#3b82f6'): string {
  if (!color || typeof color !== 'string') {
    return fallback;
  }
  const trimmed = color.trim();
  if (HEX_COLOR_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return fallback;
}

/**
 * Validates a custom domain (FQDN). Rejects protocol schemes, ports, and path separators.
 */
export function validateCustomDomain(domain: string | null | undefined): ValidationResult {
  if (!domain || typeof domain !== 'string' || domain.trim() === '') {
    return { valid: true, errors: [] }; // Optional
  }

  const errors: string[] = [];
  const normalized = domain.trim().toLowerCase();

  if (normalized.includes('://')) {
    errors.push('DOMAIN_CONTAINS_PROTOCOL');
  }
  if (normalized.includes('/') || normalized.includes('\\')) {
    errors.push('DOMAIN_CONTAINS_PATH');
  }
  if (normalized.includes(':')) {
    errors.push('DOMAIN_CONTAINS_PORT');
  }
  if (normalized.length > 253) {
    errors.push('DOMAIN_TOO_LONG');
  }
  if (!DOMAIN_REGEX.test(normalized)) {
    errors.push('DOMAIN_INVALID_FORMAT');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Rigorously sanitizes custom CSS to prevent XSS breakout attacks.
 */
export function sanitizeCustomCss(rawCss: string | null | undefined): string {
  if (!rawCss || typeof rawCss !== 'string') {
    return '';
  }

  return rawCss
    .replace(/<script[\s\S]*?<\/script>/gi, '') // Strip script tags and inner content
    .replace(/<style[\s\S]*?<\/style>/gi, '') // Strip style tags and inner content
    .replace(/<[^>]*>/g, '') // Strip any HTML tags
    .replace(/<!--[\s\S]*?-->/g, '') // Strip HTML comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Strip CSS comments
    .replace(/@import\s+[^;]+;?/gi, '') // Strip @import rules
    .replace(/expression\s*\([^)]*\)/gi, '') // Strip IE expressions
    .replace(/behavior\s*:[^;]+;?/gi, '') // Strip IE behavior
    .replace(/-moz-binding\s*:[^;]+;?/gi, '') // Strip Mozilla XBL bindings
    .replace(/javascript\s*:/gi, '') // Strip javascript: pseudo-protocol
    .replace(/vbscript\s*:/gi, '') // Strip vbscript: pseudo-protocol
    .replace(/data\s*:\s*text\/html/gi, '') // Strip data:text/html
    .trim();
}

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
