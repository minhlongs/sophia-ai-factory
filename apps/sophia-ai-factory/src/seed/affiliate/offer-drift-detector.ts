/**
 * Affiliate Offer Commission-Rate Drift & Program Shutdown Monitor.
 *
 * Clean-room pure-TS engine (MIT/BSD-3-Clause patterns from
 * marcolink/generate-json-patch, fast-json-patch, and kpdecker/jsdiff):
 * - Detects commission cuts (e.g., 3000 bps -> 1500 bps), cookie-window drops,
 *   and program shutdowns deterministically with $0 LLM COGS.
 *
 * Layer: seed/affiliate (pure deterministic diffing, zero external deps)
 *
 * @module seed/affiliate/offer-drift-detector
 */

export interface OfferSnapshot {
  readonly offerId: string;
  readonly programName: string;
  readonly commissionBps: number;
  readonly cookieWindowDays: number;
  readonly httpStatus: number;
  readonly tosHash: string;
}

export type DriftKind =
  | 'COMMISSION_CUT'
  | 'COMMISSION_INCREASE'
  | 'COOKIE_WINDOW_SHRUNK'
  | 'PROGRAM_SHUTDOWN'
  | 'TOS_CHANGED';

export interface OfferDriftAlert {
  readonly kind: DriftKind;
  readonly severity: 'critical' | 'warning' | 'info';
  readonly summary: string;
}

export function detectOfferDrift(
  previous: OfferSnapshot,
  current: OfferSnapshot,
): readonly OfferDriftAlert[] {
  const alerts: OfferDriftAlert[] = [];

  if (current.httpStatus === 404 || current.httpStatus === 410) {
    alerts.push({
      kind: 'PROGRAM_SHUTDOWN',
      severity: 'critical',
      summary: `${current.programName} returned HTTP ${current.httpStatus}`,
    });
  }
  if (current.commissionBps < previous.commissionBps) {
    alerts.push({
      kind: 'COMMISSION_CUT',
      severity: 'critical',
      summary: `Commission dropped ${(previous.commissionBps / 100).toFixed(1)}% → ${(current.commissionBps / 100).toFixed(1)}%`,
    });
  } else if (current.commissionBps > previous.commissionBps) {
    alerts.push({
      kind: 'COMMISSION_INCREASE',
      severity: 'info',
      summary: `Commission increased ${(previous.commissionBps / 100).toFixed(1)}% → ${(current.commissionBps / 100).toFixed(1)}%`,
    });
  }
  if (current.cookieWindowDays < previous.cookieWindowDays) {
    alerts.push({
      kind: 'COOKIE_WINDOW_SHRUNK',
      severity: 'warning',
      summary: `Cookie window shrunk ${previous.cookieWindowDays}d → ${current.cookieWindowDays}d`,
    });
  }
  if (current.tosHash !== previous.tosHash) {
    alerts.push({
      kind: 'TOS_CHANGED',
      severity: 'warning',
      summary: `${current.programName} affiliate Terms of Service hash changed`,
    });
  }

  return alerts;
}
