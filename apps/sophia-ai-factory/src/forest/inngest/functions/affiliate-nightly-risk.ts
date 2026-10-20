/**
 * Inngest cron: Affiliate nightly risk scoring.
 *
 * Runs nightly and recomputes a composite fraud risk score per partner from the
 * click and referral event tables, then records it on `affiliate_partners`.
 *
 * What the score is for
 *   The score is advisory. It marks a partner `under_review` when it reaches the
 *   suspicious threshold so a human can look at the evidence; it never suspends,
 *   never deletes and never blocks earning. The three rules (duplicate clicks,
 *   click velocity with a narrow client fingerprint, non-human user agents) are
 *   implemented in `@/tree/affiliates/risk-scorer`.
 *
 * Idempotency
 *   Each run rewrites `risk_score`, `risk_checked_at` and `is_suspicious` for
 *   every partner it visits, so re-running the same night refreshes the verdict
 *   rather than accumulating anything. Partners with no clicks in the window are
 *   left untouched because there is nothing to score.
 *
 * Layer: forest (infrastructure orchestration). Imports seed + tree only.
 *
 * @module forest/inngest/functions/affiliate-nightly-risk
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { getD1 } from '@/seed/db/client';
import {
  RISK_LOOKBACK_MS,
  scoreAllPartners,
  type RiskRunSummary,
} from './affiliate-nightly-risk-helpers';

export {
  RISK_LOOKBACK_MS,
  listPartnersWithRecentClicks,
  loadPartnerClicks,
  scoreSinglePartner,
  scoreAllPartners,
  writePartnerVerdict,
  type PartnerRiskCandidate,
  type PartnerRiskOutcome,
  type RiskRunSummary,
} from './affiliate-nightly-risk-helpers';

export const affiliateNightlyRisk = inngest.createFunction(
  {
    id: 'affiliate-nightly-risk',
    name: 'Affiliate Nightly Risk Scoring',
    retries: 2,
  },
  { cron: '30 3 * * *' }, // Nightly at 03:30 UTC, after the day's traffic settles
  async ({ step }) => {
    const summary = await step.run('score-partners', async (): Promise<RiskRunSummary> => {
      const db = await getD1();
      // A missing binding is not an error worth retrying: without D1 there is
      // nothing to score, and retrying cannot conjure the binding back.
      if (!db) {
        logger.warn('[affiliate-nightly-risk] D1 binding unavailable', {
          reason: 'no_d1_binding',
        });
        return {
          evaluated: 0,
          flagged: 0,
          errors: 0,
          outcomes: [],
        };
      }

      return scoreAllPartners(db, RISK_LOOKBACK_MS);
    });

    if (summary.evaluated === 0) {
      logger.info('[affiliate-nightly-risk] No partners with recent clicks', {
        flagged: summary.flagged,
        errors: summary.errors,
      });
      return summary;
    }

    logger.info('[affiliate-nightly-risk] Completed', {
      evaluated: summary.evaluated,
      flagged: summary.flagged,
      errors: summary.errors,
      flaggedPartnerIds: summary.outcomes
        .filter((outcome) => outcome.isSuspicious)
        .map((outcome) => outcome.partnerId),
    });

    return {
      evaluated: summary.evaluated,
      flagged: summary.flagged,
      errors: summary.errors,
    };
  },
);
