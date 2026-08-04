/**
 * Telegram bot analytics command handler
 *
 * Handles /analytics command — shows campaign performance snapshot
 * including campaign counts by status, affiliate clicks, conversions, and earnings.
 */

import { tryCreateServerClient } from '@/seed/db/client';
import { sendMessage } from '@/tree/telegram/handlers/utils';
import { logger } from '@/seed/utils/logger-utility';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

interface ProfileRow {
  user_id: string;
}

interface CampaignStatusRow {
  status: string;
}

interface ClickCountRow {
  total: number;
}

interface ConversionRow {
  count: number;
  total_earnings: number;
}

// -------------------------------------------------------------------------
// Handler
// -------------------------------------------------------------------------

/**
 * Handle /analytics command — shows campaign performance snapshot.
 */
export async function handleAnalytics(chatId: string): Promise<void> {
  try {
    const db = tryCreateServerClient();

if (!db) {
  await sendMessage(chatId, 'Database unavailable. Please try again later.');
  return;
}

    // 1. Resolve user from chatId
    const { data: profileData } = await db
      .from('user_profiles')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single();

    const profile = profileData as ProfileRow | null;
    if (!profile) {
      await sendMessage(chatId, '❌ Account not linked. Please use /email to setup.');
      return;
    }

    const userId = profile.user_id;

    // 2. Campaign stats — total and by status
    const { data: campaignsData } = await db
      .from('campaigns')
      .select('status')
      .eq('user_id', userId) as unknown as { data: CampaignStatusRow[] | null; error: unknown };

    const statuses = campaignsData ?? [];
    const total = statuses.length;
    const completed = statuses.filter((c) => c.status === 'completed').length;
    const active = statuses.filter((c) =>
      ['queued', 'processing_script', 'processing_video'].includes(c.status ?? '')
    ).length;
    const failed = statuses.filter((c) =>
      ['failed', 'video_timeout'].includes(c.status ?? '')
    ).length;
    const draft = statuses.filter((c) => c.status === 'draft').length;

    // 3. Affiliate clicks count
    let affiliateClicks = 0;
    try {
      const rawDb = db.unwrap();
      const clickRow = await rawDb
        .prepare('SELECT COUNT(*) as total FROM affiliate_clicks WHERE user_id = ?')
        .bind(userId)
        .first<ClickCountRow>();
      affiliateClicks = clickRow?.total ?? 0;
    } catch {
      // Table or query may not exist — non-critical
    }

    // 4. Conversion stats — count and total earnings
    let conversions = 0;
    let totalEarnings = 0;
    try {
      const rawDb = db.unwrap();
      const convRow = await rawDb
        .prepare(
          `SELECT
             COUNT(*) as count,
             COALESCE(SUM(amount_usd), 0) as total_earnings
           FROM tracking_conversions tc
           JOIN tracking_links tl ON tc.link_id = tl.id
           WHERE tl.tenant_id = ?`
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

    // 5. Build message
    const message =
      `📊 *Performance Analytics*\n\n` +
      `*Campaigns*\n` +
      `  Total: ${total}\n` +
      `  ✅ Completed: ${completed}\n` +
      `  ⚙️ Active: ${active}\n` +
      `  ❌ Failed: ${failed}\n` +
      `  📝 Draft: ${draft}\n\n` +
      `*Affiliate Tracking*\n` +
      `  🔗 Clicks: ${affiliateClicks}\n` +
      `  💰 Conversions: ${conversions}\n` +
      `  💵 Earnings: $${totalEarnings.toFixed(2)}\n\n` +
      `_Tip: Use /campaign list to see all your campaigns._`;

    await sendMessage(chatId, message);
  } catch (error) {
    logger.error(
      'Error fetching analytics',
      error instanceof Error ? error : new Error(String(error))
    );
    await sendMessage(chatId, '❌ Error fetching analytics.');
  }
}
