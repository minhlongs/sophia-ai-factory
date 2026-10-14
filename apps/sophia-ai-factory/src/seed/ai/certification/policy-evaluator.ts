/**
 * @module seed/ai/certification/policy-evaluator
 * Certification policy evaluator and blocking gate determination.
 */

import {
  type ProviderCertificationState,
  BLOCKING_STATES,
} from './types';
import { getCertification } from './capability-matrix';

/**
 * Check whether a provider's certification state blocks instantiation.
 *
 * Returns true for NOT_CERTIFIED and BLOCKED.
 * Graded states (EXPERIMENTAL, PRODUCTION_CANDIDATE, PRODUCTION_READY)
 * allow instantiation.
 */
export function isCertificationBlocking(providerId: string): boolean {
  const cert = getCertification(providerId);
  return BLOCKING_STATES.has(cert.state);
}

/**
 * Typed error thrown when a provider is blocked by certification policy.
 */
export class ProviderNotCertifiedError extends Error {
  public readonly providerId: string;
  public readonly certState: ProviderCertificationState;
  public readonly reason?: string;

  constructor(
    providerId: string,
    certState: ProviderCertificationState,
    reason?: string,
  ) {
    super(
      `PROVIDER_NOT_CERTIFIED: ${providerId} has certification state ${certState}${reason ? ` — ${reason}` : ''}`,
    );
    this.name = 'ProviderNotCertifiedError';
    this.providerId = providerId;
    this.certState = certState;
    this.reason = reason;
    Object.setPrototypeOf(this, ProviderNotCertifiedError.prototype);
  }
}
