/**
 * @module seed/ai/certification/types
 * Core certification states and interfaces for AI providers.
 */

export enum ProviderCertificationState {
  NOT_CERTIFIED = 'NOT_CERTIFIED',
  EXPERIMENTAL = 'EXPERIMENTAL',
  PRODUCTION_CANDIDATE = 'PRODUCTION_CANDIDATE',
  PRODUCTION_READY = 'PRODUCTION_READY',
  BLOCKED = 'BLOCKED',
}

export interface ProviderCertification {
  state: ProviderCertificationState;
  security: 'PASS' | 'BLOCKED' | 'NOT_EVALUATED';
  health: 'PASS' | 'BLOCKED' | 'NOT_EVALUATED';
  canary: 'PASS' | 'BLOCKED' | 'NOT_EVALUATED';
  certifiedAt?: string;
  certifiedBy?: string;
  reason?: string;
}

export const BLOCKING_STATES: ReadonlySet<ProviderCertificationState> = new Set([
  ProviderCertificationState.NOT_CERTIFIED,
  ProviderCertificationState.BLOCKED,
]);

export interface CertifiedProviderResolution {
  /** The provider to actually use (preferred, or diverted fallback) */
  readonly provider: string;
  /** True if preferred provider was blocked and execution was diverted to a fallback */
  readonly diverted: boolean;
  /** The original preferred provider requested (e.g. 'hermes') */
  readonly originalProvider: string;
  /** Certification state of the original provider */
  readonly originalState: ProviderCertificationState;
  /** Explanatory rationale for logging and audit trails */
  readonly reason?: string;
}
