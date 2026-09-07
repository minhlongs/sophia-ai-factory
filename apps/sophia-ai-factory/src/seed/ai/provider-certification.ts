/**
 * @module seed/ai/provider-certification
 *
 * Provider certification state machine.
 *
 * Five-state certification: NOT_CERTIFIED | EXPERIMENTAL | PRODUCTION_CANDIDATE |
 * PRODUCTION_READY | BLOCKED.
 *
 * Orthogonal to provider status dimensions (REGISTERED / AVAILABLE /
 * CERTIFIED / ENABLED) — certification is a runtime policy gate, not
 * an interface contract.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

/**
 * Certification states — ordered from least to most trusted.
 *
 * - NOT_CERTIFIED: never evaluated (default for unknown providers).
 * - EXPERIMENTAL: evaluated but not production-ready.
 * - PRODUCTION_CANDIDATE: passes health + security but no sustained track record.
 * - PRODUCTION_READY: all gates passed, production evidence exists.
 * - BLOCKED: explicitly blocked — must not be instantiated.
 */
export enum ProviderCertificationState {
  NOT_CERTIFIED = 'NOT_CERTIFIED',
  EXPERIMENTAL = 'EXPERIMENTAL',
  PRODUCTION_CANDIDATE = 'PRODUCTION_CANDIDATE',
  PRODUCTION_READY = 'PRODUCTION_READY',
  BLOCKED = 'BLOCKED',
}

/**
 * Per-dimension assessment for a provider certification.
 */
export interface ProviderCertification {
  state: ProviderCertificationState;
  security: 'PASS' | 'BLOCKED' | 'NOT_EVALUATED';
  health: 'PASS' | 'BLOCKED' | 'NOT_EVALUATED';
  canary: 'PASS' | 'BLOCKED' | 'NOT_EVALUATED';
  certifiedAt?: string;
  certifiedBy?: string;
  reason?: string;
}

/**
 * States that block provider instantiation.
 * NOT_CERTIFIED and BLOCKED both prevent creation.
 * EXPERIMENTAL, PRODUCTION_CANDIDATE, PRODUCTION_READY allow instantiation.
 */
const BLOCKING_STATES: ReadonlySet<ProviderCertificationState> = new Set([
  ProviderCertificationState.NOT_CERTIFIED,
  ProviderCertificationState.BLOCKED,
]);

// ── Module-level registry ────────────────────────────────────────────────────

const certificationStates = new Map<string, ProviderCertification>();

/**
 * Register a provider's certification state.
 *
 * Called at module load time by adapters that declare their own
 * certification status (e.g. hermes-antigravity-adapter declares BLOCKED).
 */
export function registerCertification(
  providerId: string,
  cert: ProviderCertification,
): void {
  certificationStates.set(providerId, cert);
}

/**
 * Retrieve the certification for a provider.
 *
 * Returns a NOT_CERTIFIED default if no explicit registration exists.
 */
export function getCertification(providerId: string): ProviderCertification {
  return (
    certificationStates.get(providerId) ?? {
      state: ProviderCertificationState.NOT_CERTIFIED,
      security: 'NOT_EVALUATED',
      health: 'NOT_EVALUATED',
      canary: 'NOT_EVALUATED',
    }
  );
}

/**
 * Check whether a provider's certification state blocks instantiation.
 *
 * Returns true for NOT_CERTIFIED and BLOCKED.
 * All graded states (EXPERIMENTAL, PRODUCTION_CANDIDATE, PRODUCTION_READY)
 * allow instantiation — they represent readiness levels, not gates.
 */
export function isCertificationBlocking(providerId: string): boolean {
  const cert = getCertification(providerId);
  return BLOCKING_STATES.has(cert.state);
}

/**
 * Typed error thrown when a provider is blocked by certification.
 *
 * Carries providerId, certState, and reason — all safe for logging
 * (no secrets, no tokens, no credentials).
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
