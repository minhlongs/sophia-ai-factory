/**
 * Sentry Symbolication Opt-In — doctrine-compliant source-map upload gate.
 *
 * NO-TECH DOCTRINE (binding): the platform must function fully WITHOUT any
 * operator-provided third-party credential. `SENTRY_AUTH_TOKEN` is OPTIONAL:
 *   - present  → sourcemaps upload at deploy time (symbolicated stack traces)
 *   - absent   → deploy proceeds, errors captured with minified stacks
 *
 * This module is the single source of truth for that decision. Absence of the
 * token is logged at INFO (never error/warn) so the doctrine rule "absent
 * token never blocks build or deploy" is enforced by construction.
 *
 * @module seed/observability/sentry-symbolication-opt-in
 */

import { logger } from '@/seed/utils/logger-utility';

/** Deploy-time decision result for sourcemap upload. */
export interface SymbolicationDecision {
  /** True when SENTRY_AUTH_TOKEN is present — upload sourcemaps. */
  enabled: boolean;
  /** Human-readable reason — safe for deploy logs (no token material). */
  reason: string;
}

/**
 * Decide whether sourcemap upload should run at deploy time.
 *
 * Pure function of environment — no side effects beyond logging.
 * ALWAYS returns a decision that permits deploy to continue.
 */
export function decideSymbolication(env: Record<string, string | undefined> = process.env): SymbolicationDecision {
  const token = env.SENTRY_AUTH_TOKEN?.trim();

  if (token && token.length > 0) {
    logger.info('[sentry-symbolication] SENTRY_AUTH_TOKEN present — sourcemap upload enabled', {});
    return { enabled: true, reason: 'SENTRY_AUTH_TOKEN present' };
  }

  // Absent token is the NORMAL doctrine-compliant state — info, not warn.
  logger.info('[sentry-symbolication] SENTRY_AUTH_TOKEN absent — deploy proceeds without symbolication (doctrine: token optional)', {});
  return { enabled: false, reason: 'SENTRY_AUTH_TOKEN absent (optional per no-tech doctrine)' };
}

/**
 * Post-build sourcemap gate. Used by deploy tooling to assert that a missing
 * token never fails the build. Returns "proceed" in every state.
 */
export function assertSymbolicationNonBlocking(_decision: SymbolicationDecision): 'proceed' {
  // The only possible outcome is proceed — absence cannot block deploy.
  void _decision;
  return 'proceed';
}
