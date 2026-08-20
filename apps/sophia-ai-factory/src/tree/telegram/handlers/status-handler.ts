import { tryCreateServerClientSync, D1Client } from '@/seed/db/client';
import { sendMessage } from '@/tree/telegram/handlers/utils';
import { logger } from '@/seed/utils/logger-utility';

let _statusDb: D1Client | null = null;
export function resetStatusDb() { _statusDb = null; }
function getStatusDb(): D1Client | null {
  if (!_statusDb) _statusDb = tryCreateServerClientSync();
  return _statusDb;
}

const MAX_FIELD_LENGTH = 120;
const MAX_LIST_ROWS = 10;
const TRUNCATION_SUFFIX = '…';

function truncate(value: string | null | undefined, max = MAX_FIELD_LENGTH): string {
  const base = value ?? '';
  return base.length > max ? `${base.slice(0, max)}${TRUNCATION_SUFFIX}` : base;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

interface CampaignRow {
  id: string;
  title: string;
  status: string | null;
  progress: number | null;
  created_at: string;
  updated_at: string;
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
    let headerEmoji: string;

    if (campaignId) {
      // Single campaign status lookup
      const { data } = await db
        .from('campaigns')
        .select('id, title, status, progress, created_at, updated_at')
        .eq('id', campaignId)
        .maybeSingle();

      const row = data as unknown as CampaignRow | null;
      if (!row) {
        message =
          '📭 *Không tìm thấy chiến dịch*\n\nID không hợp lệ hoặc không thuộc tài khoản này.\n\n📭 _Campaign not found_\n\nInvalid ID or the campaign does not belong to your account.';
        await sendMessage(chatId, message);
        return;
      }

      headerEmoji =
        row.status === 'completed'
          ? '✅'
          : row.status === 'failed'
            ? '❌'
            : row.status === 'queued'
              ? '⏳'
              : '⚙️';

      const statusHuman = row.status?.replace(/_/g, ' ') ?? 'unknown';
      const title = truncate(row.title);
      message = `${headerEmoji} *Trạng thái / Status: ${title}*\n\n`;
      message += ` ID: \`${row.id.slice(0, 8)}\`\n`;
      message += ` Trạng thái / Status: ${statusHuman}\n`;
      message += ` Tiến độ / Progress: ${row.progress ?? 0}%\n`;
      message += ` Tạo lúc / Created: ${new Date(row.created_at).toLocaleDateString()}\n`;
      message += ` Cập nhật / Updated: ${new Date(row.updated_at).toLocaleDateString()}\n`;
    } else {
      // List all non-draft / non-completed campaigns (active work)
      const { data: rows } = await db
        .from<CampaignRow>('campaigns')
        .select('id, title, status, progress, created_at, updated_at')
        .eq('user_id', userId)
        .not('status', 'in', '("draft","completed","failed","video_timeout")')
        .order('created_at', { ascending: false })
        .limit(MAX_LIST_ROWS);

      const campaigns = (rows as CampaignRow[] | null) ?? [];

      headerEmoji = '📊';
      if (campaigns.length === 0) {
        message =
          `${headerEmoji} *Không có chiến dịch đang hoạt động / No Active Campaigns*\n\n` +
          `Tạo chiến dịch mới với /campaign <chủ đề>.\n\n` +
          `_Create a new one with \`/campaign <topic>\`._`;
        await sendMessage(chatId, message);
        return;
      }

      const statusEmoji = (s: string | null | undefined) => {
        if (s === 'queued') return '⏳';
        if (s?.startsWith('processing_')) return '⚙️';
        if (s === 'completed') return '✅';
        if (s === 'failed') return '❌';
        return '•';
      };

      message = `${headerEmoji} *Chiến dịch đang chạy / Active Campaigns:*\n\n`;
      campaigns.forEach((c, idx) => {
        const emoji = statusEmoji(c.status);
        const statusHuman = (c.status ?? 'unknown').replace(/_/g, ' ');
        const title = truncate(c.title);
        message += `${idx + 1}. ${emoji} *${title}*\n`;
        message += ` ID: \`${c.id.slice(0, 8)}\`\n`;
        message += ` TT / Status: ${statusHuman} (${c.progress ?? 0}%)\n`;
        message += ` Tạo / Created: ${new Date(c.created_at).toLocaleDateString()}\n\n`;
      });
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
