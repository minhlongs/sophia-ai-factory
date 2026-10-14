import { tryCreateServerClientSync, D1Client } from '@/seed/db/client';
import { sendMessage } from '@/tree/telegram/handlers/utils';
import { logger } from '@/seed/utils/logger-utility';
import {
  formatResultsMarkdown,
  type CampaignRow,
} from './results-formatter';

let _resultsDb: D1Client | null = null;
export function resetResultsDb() { _resultsDb = null; }
function getResultsDb(): D1Client | null {
  if (!_resultsDb) _resultsDb = tryCreateServerClientSync();
  return _resultsDb;
}

interface ProfileRow {
  user_id: string;
}

async function resolveUserId(chatId: string, d1: D1Client | null): Promise<string | null> {
  if (!d1) return null;
  const { data } = await d1
    .from('user_profiles')
    .select('user_id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();
  if (!data) return null;
  return (data as unknown as ProfileRow).user_id;
}

// ---------------------------------------------------------------------------
// /results [campaignId]
// - Without ID → top 5 completed campaigns with video_url for the linked user
// - With ID → single campaign result lookup (ownership check via user)
// ---------------------------------------------------------------------------
export async function handleResults(chatId: string, campaignId?: string): Promise<void> {
  try {
    const d1 = getResultsDb();
    if (!d1) {
      await sendMessage(chatId, 'Database unavailable. Please try again later.');
      return;
    }

    const userId = await resolveUserId(chatId, d1);
    if (!userId) {
      await sendMessage(
        chatId,
        '⚠️ *Chưa liên kết tài khoản*\n\nVui lòng nhập /email <email@cuaban.com> để liên kết.\n\n⚠️ _Account not linked_\n\nPlease run `/email your@email.com` to link your Sophia account.',
      );
      return;
    }

    if (campaignId) {
      const { data } = await d1
        .from<CampaignRow>('campaigns')
        .select('id, title, video_url, updated_at, status, user_id')
        .eq('id', campaignId)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const row = data as unknown as CampaignRow | null;
      if (!row) {
        await sendMessage(
          chatId,
          '📭 *Không tìm thấy kết quả / No results found*\n\nID không hợp lệ hoặc không thuộc tài khoản này.\n_Invalid ID or the campaign does not belong to your account._',
        );
        return;
      }

      const markdown = formatResultsMarkdown([row], campaignId);
      await sendMessage(chatId, markdown);
      return;
    }

    const { data } = await d1
      .from<CampaignRow>('campaigns')
      .select('id, title, video_url, updated_at, status, user_id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(5);

    const campaigns = (data as CampaignRow[] | null) ?? [];

    if (campaigns.length === 0) {
      await sendMessage(
        chatId,
        'ℹ️ *Chưa có kết quả / No results yet*\n\nTạo chiến dịch với /campaign <chủ đề> rồi chờ hoàn thành.\n\n_Create one with `/campaign <topic>` and wait for completion._',
      );
      return;
    }

    const markdown = formatResultsMarkdown(campaigns, undefined);
    await sendMessage(chatId, markdown);
  } catch (error) {
    logger.error('[telegram-results]', error instanceof Error ? error : new Error(String(error)));
    await sendMessage(
      chatId,
      '❌ Không thể đọc kết quả. Vui lòng thử lại sau.\n\n❌ _Failed to fetch results. Try again later._',
    );
  }
}
