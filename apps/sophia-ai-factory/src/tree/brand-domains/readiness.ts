/**
 * Brand Domain Registry Readiness Gates & Validation
 * Layer: tree
 *
 * Enforces all 10 mandatory readiness checks before a brand domain can
 * transition to ACTIVE status.
 *
 * @module tree/brand-domains/readiness
 */

import {
  isValidExactHostname,
  normalizeExactHostname,
  type BrandDomainReadinessChecks,
} from '@/seed/domain';

export const READINESS_CHECK_KEYS: readonly (keyof BrandDomainReadinessChecks)[] = [
  'ownershipVerified',
  'cfZoneEligible',
  'workerAttached',
  'tlsVerified',
  'authOriginVerified',
  'accessPolicyVerified',
  'tenantAuthVerified',
  'noPublicBypassVerified',
  'externalCallbacksReviewed',
  'smokeVerified',
] as const;

export const EMPTY_READINESS_CHECKS: BrandDomainReadinessChecks = {
  ownershipVerified: false,
  cfZoneEligible: false,
  workerAttached: false,
  tlsVerified: false,
  authOriginVerified: false,
  accessPolicyVerified: false,
  tenantAuthVerified: false,
  noPublicBypassVerified: false,
  externalCallbacksReviewed: false,
  smokeVerified: false,
};

export interface ReadinessEvaluation {
  readonly readyToActivate: boolean;
  readonly passedCount: number;
  readonly totalCount: number;
  readonly missingChecks: readonly (keyof BrandDomainReadinessChecks)[];
}

export function evaluateDomainReadiness(
  checks: BrandDomainReadinessChecks,
): ReadinessEvaluation {
  const missingChecks = READINESS_CHECK_KEYS.filter((key) => !checks[key]);
  return {
    readyToActivate: missingChecks.length === 0,
    passedCount: READINESS_CHECK_KEYS.length - missingChecks.length,
    totalCount: READINESS_CHECK_KEYS.length,
    missingChecks,
  };
}

/**
 * Validates that a candidate brand domain hostname is an exact public FQDN
 * (not localhost, not an IP, not a wildcard, and not a Cloudflare workers.dev
 * technical domain which is managed by TECHNICAL_RUNTIME_IDENTITY).
 */
export function validateBrandDomainCandidate(rawHostname: string): {
  valid: boolean;
  hostname: string;
  error?: string;
} {
  const normalized = normalizeExactHostname(rawHostname);
  if (!normalized || !isValidExactHostname(normalized)) {
    return {
      valid: false,
      hostname: normalized,
      error: 'Invalid exact hostname (no protocol, path, port, or wildcard allowed)',
    };
  }
  if (normalized === 'localhost' || normalized === '127.0.0.1') {
    return {
      valid: false,
      hostname: normalized,
      error: 'Local development hosts cannot be registered as brand domains',
    };
  }
  if (normalized.endsWith('.workers.dev') || normalized === 'workers.dev') {
    return {
      valid: false,
      hostname: normalized,
      error: 'Cloudflare workers.dev hostnames are technical runtime identities, not brand domains',
    };
  }
  return { valid: true, hostname: normalized };
}
