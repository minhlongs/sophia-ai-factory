import { tryCreateServerClient, D1Client } from '@/seed/db/client';
import { sendMessage } from '@/tree/telegram/handlers/utils';
import { logger } from '@/seed/utils/logger-utility';

let _resultsDb: D1Client | null = null;
export function resetResultsDb() { _resultsDb = null; }
function getResultsDb(): D1Client | null {
  if (!_resultsDb) _resultsDb = tryCreateServerClient();
  return _resultsDb;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

interface CampaignRow {
  id: string;
  title: string;
  video_url: string | null;
  updated_at: string;
  status: string | null;
  user_id: string;
}

// Drop fragment/doc open id; preserve downloadable view.
type DriveSnippet = {
  mimeType?: string | null;
  name?: string | null;
  url?: string | null;
};

// Safe MarkdownV2 escape for user-provided content only (URLs, titles).
// Structural chars (newlines, *, backticks, parens, brackets) are kept as-is.
function escapeMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.]/g, '\\$&');
}

function redactDriveUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lo = raw.toLowerCase();
  if (!lo.includes('drive.google.com') && !lo.includes('docs.google.com')) return raw;
  try {
    const u = new URL(raw);
    // drop fragment, prefer non-download view
    u.hash = '';
    if (u.pathname === '/open') u.pathname = '/file/d';
    if (u.searchParams.has('id')) {
      const id = u.searchParams.get('id');
      u.pathname = `/file/d/${encodeURIComponent(id!)}/view`;
      u.search = '';
    }
    return u.toString();
  } catch {
    return raw;
  }
}

function looksLikeDriveSnippet(raw: unknown, fallback: string | null): string | null {
  if (typeof raw === 'string') return redactDriveUrl(raw);
  if (raw && typeof raw === 'object' && 'url' in (raw as DriveSnippet)) {
    const maybe = redactDriveUrl((raw as DriveSnippet).url ?? null);
    if (maybe) return maybe;
  }
  return fallback;
}

function formatResultsMarkdown(campaigns: CampaignRow[], filterId?: string): string {
  const filtered = filterId ? campaigns.filter((c) => c.id === filterId) : campaigns;

  let header = '✅ *Kết quả / Results:*\n\n';
  if (filterId && filtered.length === 0) {
    return '📭 *Không tìm thấy kết quả / No results found*\n\n_ID không hợp lệ hoặc chưa có video hoàn thành._\n_Invalid ID or no completed video for this campaign._';
  }

  header += `_${filtered.length} chiến dịch hoàn thành / completed campaigns_\n\n`;

  let body = '';
  filtered.forEach((c) => {
    const raw = looksLikeDriveSnippet(c.video_url, c.video_url);
    body += `🎬 *${escapeMd(c.title)}*\n`;
    if (raw) {
      body += `🎥 [Xem video / Watch video](${escapeMd(raw)})\n`;
    } else {
      body += `_(Video URL chưa có / Video URL missing)_\n`;
    }
    body += ` Cập nhật / Updated: ${new Date(c.updated_at).toLocaleDateString()}\n\n`;
  });

  return header + body;
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
      // Single-campaign lookup; ownership enforced by user_id
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

    // Recent completed campaigns for the user
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
