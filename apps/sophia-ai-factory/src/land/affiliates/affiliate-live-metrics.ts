/**
 * Workspace affiliate production metrics.
 *
 * Reads the figures the affiliates dashboard shows as workspace facts: videos
 * the workspace generated, and clicks its bridge page received. Commission is
 * deliberately NOT read here — it comes from the Domain B reconciliation pass
 * (`fetchWorkspaceDomainBReconciliation`), which is the only path that applies
 * the platform-fee-zero and per-currency invariants.
 *
 * Honesty contract: a figure this module could not read is reported as
 * unavailable. It is never reported as `0`, because a workspace that produced
 * 900 videos and a workspace whose video count could not be read are different
 * facts and must be presented differently.
 *
 * Two keying systems are in play and are queried separately:
 *  - `campaigns.user_id` is a user id;
 *  - `affiliate_partners.user_id` is a user id, and its `id` is the
 *    `affiliate_referral_clicks.affiliate_partner_id` and the
 *    `commission_ledger.affiliate_id`. `affiliate_partners` has no tenant
 *    column at any migration, so partner and click counts are read by user.
 *
 * Layer: land/affiliates
 * @module land/affiliates/affiliate-live-metrics
 */

import type { AffiliateMetrics } from '@/app/[locale]/dashboard/affiliates/affiliates-dashboard-sections';

export interface WorkspaceAffiliateMetrics {
  metrics: AffiliateMetrics;
  /** Per-figure readability, so the UI can show an unavailable marker per card. */
  availability: {
    totalVideosGenerated: boolean;
    totalBridgeClicks: boolean;
  };
}

export const AFFILIATE_METRICS_UNAVAILABLE: WorkspaceAffiliateMetrics = {
  metrics: {
    totalVideosGenerated: 0,
    totalBridgeClicks: 0,
    totalCommissionUsd: 0,
    activeNiches: [],
  },
  availability: {
    totalVideosGenerated: false,
    totalBridgeClicks: false,
  },
};

/** Reads one scalar count. Returns null when the statement itself could not run. */
async function readCount(
  db: D1Database,
  sql: string,
  bindings: string[],
): Promise<number | null> {
  try {
    const row = await db.prepare(sql).bind(...bindings).first<{ count: number | string }>();
    if (!row) return 0;
    return typeof row.count === 'number' ? row.count : Number(row.count) || 0;
  } catch {
    return null;
  }
}

/**
 * Reads the workspace's video and bridge-click counts by user id.
 *
 * Each read is independent: a failure in the click lookup does not suppress the
 * video count, and vice versa.
 */
export async function loadWorkspaceAffiliateMetrics(
  db: D1Database,
  userId: string,
): Promise<WorkspaceAffiliateMetrics> {
  const videos = await readCount(
    db,
    `SELECT COUNT(*) as count FROM campaigns WHERE user_id = ?`,
    [userId],
  );

  // A user may have no partner profile at all. That is a real zero, not a
  // failure: there is no profile to attribute clicks to, so the count is 0.
  // Only a failed lookup is distinguishable, and that is reported as null.
  let partner: { id: string } | null | undefined;
  let partnerLookupOk = true;
  try {
    partner = await db
      .prepare(`SELECT id FROM affiliate_partners WHERE user_id = ?`)
      .bind(userId)
      .first<{ id: string }>();
  } catch {
    partnerLookupOk = false;
  }

  const clicks = !partnerLookupOk
    ? null
    : partner?.id
      ? await readCount(
          db,
          `SELECT COUNT(*) as count FROM affiliate_referral_clicks WHERE affiliate_partner_id = ?`,
          [partner.id],
        )
      : 0;

  return {
    metrics: {
      totalVideosGenerated: videos ?? 0,
      totalBridgeClicks: clicks ?? 0,
      totalCommissionUsd: 0,
      activeNiches: [],
    },
    availability: {
      totalVideosGenerated: videos !== null,
      totalBridgeClicks: clicks !== null,
    },
  };
}
