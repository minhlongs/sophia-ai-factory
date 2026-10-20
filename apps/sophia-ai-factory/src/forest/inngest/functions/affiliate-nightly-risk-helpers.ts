/**
 * Affiliate nightly risk helpers — the DB-facing half of the risk job.
 *
 * The pure scoring rules live in `@/tree/affiliates/risk-scorer`; this module
 * only reads a click window per partner and writes the verdict back. Keeping
 * the I/O here means the job body stays readable and the threshold logic can be
 * tested without a live D1 binding.
 *
 * Only `ip_hash` and the truncated `user_agent` are ever read. Raw IPs are not
 * stored by `affiliate_referral_clicks` and are not reconstructed here.
 *
 * @module forest/inngest/functions/affiliate-nightly-risk-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  computeRiskVerdict,
  resolvePartnerStatusAfterRisk,
  type ClickSample,
  type PartnerStatusLike,
} from '@/tree/affiliates/risk-scorer';

/** A partner that has recorded at least one click, and its current state. */
export interface PartnerRiskCandidate {
  id: string;
  status: PartnerStatusLike;
}

/** The persisted outcome for one partner. */
export interface PartnerRiskOutcome {
  partnerId: string;
  score: number;
  isSuspicious: boolean;
  /** Status the partner moved to, when the verdict changed it. */
  statusChanged: boolean;
  clickCount: number;
}

/** Result of a whole run. */
export interface RiskRunSummary {
  /** Partners successfully scored and written. */
  evaluated: number;
  /** Partners whose verdict reached the suspicious threshold. */
  flagged: number;
  /** Partners whose read or write failed; the run continued regardless. */
  errors: number;
  outcomes: PartnerRiskOutcome[];
}

/** How far back the lookback window reaches. */
export const RISK_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * List partners that have at least one click inside the lookback window.
 *
 * Suspended partners are still listed so their score is refreshed, but the
 * status resolver refuses to lift a human suspension, so the row is maintained
 * without any enforcement change.
 */
export async function listPartnersWithRecentClicks(
  db: D1Database,
  lookbackMs: number,
): Promise<PartnerRiskCandidate[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT p.id AS id, p.status AS status
         FROM affiliate_referral_clicks c
         JOIN affiliate_partners p ON p.id = c.affiliate_partner_id
        WHERE c.created_at >= ?`,
    )
    .bind(Date.now() - lookbackMs)
    .all<{ id: string; status: PartnerStatusLike }>();

  return result.results ?? [];
}

/** Read the click window for one partner, ordered oldest-first. */
export async function loadPartnerClicks(
  db: D1Database,
  partnerId: string,
  lookbackMs: number,
): Promise<ClickSample[]> {
  const result = await db
    .prepare(
      `SELECT ip_hash AS ipHash, user_agent AS userAgent, created_at AS createdAt
         FROM affiliate_referral_clicks
        WHERE affiliate_partner_id = ? AND created_at >= ?
        ORDER BY created_at ASC`,
    )
    .bind(partnerId, Date.now() - lookbackMs)
    .all<{ ipHash: string | null; userAgent: string | null; createdAt: number }>();

  return (result.results ?? []).map((row) => ({
    ipHash: row.ipHash,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
  }));
}

/**
 * Persist one partner's verdict.
 *
 * Writes the score, the timestamp and the flag, and updates `status` only when
 * the resolver says the verdict actually changes it. `is_suspicious` is
 * advisory: it marks a partner for human review rather than taking an action.
 */
export async function writePartnerVerdict(
  db: D1Database,
  partnerId: string,
  nextStatus: PartnerStatusLike,
  score: number,
  isSuspicious: boolean,
): Promise<void> {
  await db
    .prepare(
      `UPDATE affiliate_partners
          SET risk_score = ?,
              risk_checked_at = ?,
              is_suspicious = ?,
              status = ?
        WHERE id = ?`,
    )
    .bind(score, Date.now(), isSuspicious ? 1 : 0, nextStatus, partnerId)
    .run();
}

/**
 * Score one partner and persist the verdict.
 *
 * Isolated per partner so a single partner's failure never aborts the run: the
 * error is logged, counted, and the next partner is attempted.
 */
export async function scoreSinglePartner(
  db: D1Database,
  partner: PartnerRiskCandidate,
  lookbackMs: number,
): Promise<PartnerRiskOutcome> {
  const clicks = await loadPartnerClicks(db, partner.id, lookbackMs);
  const verdict = computeRiskVerdict(clicks, lookbackMs);
  const nextStatus = resolvePartnerStatusAfterRisk(partner.status, verdict);

  await writePartnerVerdict(
    db,
    partner.id,
    nextStatus,
    verdict.score,
    verdict.isSuspicious,
  );

  return {
    partnerId: partner.id,
    score: verdict.score,
    isSuspicious: verdict.isSuspicious,
    statusChanged: nextStatus !== partner.status,
    clickCount: clicks.length,
  };
}

/** Score every partner, never letting one failure stop the sweep. */
export async function scoreAllPartners(
  db: D1Database,
  lookbackMs: number,
): Promise<RiskRunSummary> {
  const partners = await listPartnersWithRecentClicks(db, lookbackMs);
  const summary: RiskRunSummary = {
    evaluated: 0,
    flagged: 0,
    errors: 0,
    outcomes: [],
  };

  if (partners.length === 0) return summary;

  for (const partner of partners) {
    try {
      const outcome = await scoreSinglePartner(db, partner, lookbackMs);
      summary.evaluated += 1;
      if (outcome.isSuspicious) summary.flagged += 1;
      summary.outcomes.push(outcome);
    } catch (err) {
      summary.errors += 1;
      logger.error('[affiliate-nightly-risk] partner scoring failed', {
        partnerId: partner.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return summary;
}
