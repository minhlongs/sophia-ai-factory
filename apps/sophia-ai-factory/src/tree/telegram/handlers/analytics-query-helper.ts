/**
 * Telegram Analytics Query & Message Formatting Helpers
 *
 * Layer: tree/telegram/handlers
 *
 * @module tree/telegram/handlers/analytics-query-helper
 */

export interface ProfileRow {
  user_id: string;
}

export interface CampaignStatusRow {
  status: string;
}

interface ClickCountRow {
  total: number;
}

interface ConversionRow {
  count: number;
  total_earnings: number;
}

export interface RawAnalyticsDb {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
}

export interface AnalyticsSnapshotStats {
  total: number;
  completed: number;
  active: number;
  failed: number;
  draft: number;
  affiliateClicks: number;
  conversions: number;
  totalEarnings: number;
}

export function summarizeCampaignStatuses(statuses: CampaignStatusRow[]): {
  total: number;
  completed: number;
  active: number;
  failed: number;
  draft: number;
} {
  const total = statuses.length;
  const completed = statuses.filter((c) => c.status === 'completed').length;
  const active = statuses.filter((c) =>
    ['queued', 'processing_script', 'processing_video'].includes(c.status ?? ''),
  ).length;
  const failed = statuses.filter((c) =>
    ['failed', 'video_timeout'].includes(c.status ?? ''),
  ).length;
  const draft = statuses.filter((c) => c.status === 'draft').length;
  return { total, completed, active, failed, draft };
}

export async function queryAffiliateAndConversionStats(
  getRawDb: () => RawAnalyticsDb,
  userId: string,
): Promise<{ affiliateClicks: number; conversions: number; totalEarnings: number }> {
  let affiliateClicks = 0;
  try {
    const rawDb = getRawDb();
    const clickRow = await rawDb
      .prepare('SELECT COUNT(*) as total FROM affiliate_clicks WHERE user_id = ?')
      .bind(userId)
      .first<ClickCountRow>();
    affiliateClicks = clickRow?.total ?? 0;
  } catch {
    // Table or query may not exist — non-critical
  }

  let conversions = 0;
  let totalEarnings = 0;
  try {
    const rawDb = getRawDb();
    const convRow = await rawDb
      .prepare(
        `SELECT
           COUNT(*) as count,
           COALESCE(SUM(amount_usd), 0) as total_earnings
         FROM tracking_conversions tc
         JOIN tracking_links tl ON tc.link_id = tl.id
         WHERE tl.tenant_id = ?`,
      )
      .bind(userId)
      .first<ConversionRow>();
    if (convRow) {
      conversions = convRow.count;
      totalEarnings = convRow.total_earnings;
    }
  } catch {
    // Table or query may not exist — non-critical
  }

  return { affiliateClicks, conversions, totalEarnings };
}

export function formatAnalyticsMessage(stats: AnalyticsSnapshotStats): string {
  return (
    `📊 *Performance Analytics*\n\n` +
    `*Campaigns*\n` +
    `  Total: ${stats.total}\n` +
    `  ✅ Completed: ${stats.completed}\n` +
    `  ⚙️ Active: ${stats.active}\n` +
    `  ❌ Failed: ${stats.failed}\n` +
    `  📝 Draft: ${stats.draft}\n\n` +
    `*Affiliate Tracking*\n` +
    `  🔗 Clicks: ${stats.affiliateClicks}\n` +
    `  💰 Conversions: ${stats.conversions}\n` +
    `  💵 Earnings: $${stats.totalEarnings.toFixed(2)}\n\n` +
    `_Tip: Use /campaign list to see all your campaigns._`
  );
}
