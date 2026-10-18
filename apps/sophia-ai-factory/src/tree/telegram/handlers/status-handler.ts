import { tryCreateServerClientSync, D1Client } from '@/seed/db/client';
import { sendMessage } from '@/tree/telegram/handlers/utils';
import { logger } from '@/seed/utils/logger-utility';
import {
  type CampaignRow,
  formatSingleCampaignStatus,
  formatActiveCampaignsList,
} from './status-message-formatter';

let _statusDb: D1Client | null = null;
export function resetStatusDb() { _statusDb = null; }
function getStatusDb(): D1Client | null {
  if (!_statusDb) _statusDb = tryCreateServerClientSync();
  return _statusDb;
}

const MAX_LIST_ROWS = 10;

interface ProfileRow {
  user_id: string;
}

async function resolveUserId(chatId: string): Promise<string | null> {
  const db = getStatusDb();
  if (!db) return null;
  const { data } = await db
    .from('user_profiles')
    .select('user_id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();
  if (!data) return null;
  return (data as unknown as ProfileRow).user_id;
}

// ---------------------------------------------------------------------------
// /status [campaignId]
// Without ID → list non-draft campaigns with status, scoped to linked account
// With ID → single lookup for the requested campaign (ownership check)
// ---------------------------------------------------------------------------
export async function handleStatus(chatId: string, campaignId?: string): Promise<void> {
  try {
    const db = getStatusDb();
    if (!db) {
      await sendMessage(chatId, 'Database unavailable. Please try again later.');
      return;
    }

    const userId = await resolveUserId(chatId);
    if (!userId) {
      await sendMessage(
        chatId,
        '⚠️ *Chưa liên kết tài khoản*\n\nVui lòng nhập /email <email@cuaban.com> để liên kết.\n\n⚠️ _Account not linked_\n\nPlease run `/email your@email.com` to link your Sophia account.',
      );
      return;
    }

    let message: string;

    if (campaignId) {
      const { data } = await db
        .from('campaigns')
        .select('id, title, status, progress, created_at, updated_at')
        .eq('id', campaignId)
        .eq('user_id', userId)
        .maybeSingle();

      const row = data as unknown as CampaignRow | null;
      if (!row) {
        message =
          '📭 *Không tìm thấy chiến dịch*\n\nID không hợp lệ hoặc không thuộc tài khoản này.\n\n📭 _Campaign not found_\n\nInvalid ID or the campaign does not belong to your account.';
        await sendMessage(chatId, message);
        return;
      }

      message = formatSingleCampaignStatus(row);
    } else {
      const { data: rows } = await db
        .from<CampaignRow>('campaigns')
        .select('id, title, status, progress, created_at, updated_at')
        .eq('user_id', userId)
        .not('status', 'in', '("draft","completed","failed","video_timeout")')
        .order('created_at', { ascending: false })
        .limit(MAX_LIST_ROWS);

      const campaigns = (rows as CampaignRow[] | null) ?? [];
      message = formatActiveCampaignsList(campaigns);
    }

    await sendMessage(chatId, message);
  } catch (error) {
    logger.error('[telegram-status]', error instanceof Error ? error : new Error(String(error)));
    await sendMessage(
      chatId,
      '❌ Không thể đọc trạng thái. Vui lòng thử lại sau.\n\n❌ _Failed to fetch status. Try again later._',
    );
  }
}
