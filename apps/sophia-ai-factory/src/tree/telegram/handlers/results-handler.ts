import { createServerClient } from '@/seed/db/client'
import { sendMessage } from '@/tree/telegram/handlers/utils'
import { logger } from '@/seed/utils/logger-utility'

const db = () => createServerClient()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ProfileRow {
  user_id: string
}

async function resolveUserId(chatId: string): Promise<string | null> {
  const { data } = await db()
    .from('user_profiles')
    .select('user_id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()
  if (!data) return null
  return (data as unknown as ProfileRow).user_id
}

interface CampaignRow {
  id: string
  title: string
  video_url: string | null
  updated_at: string
  status: string | null
  user_id: string
}

// Safe MarkdownV2 escape for user-provided content only (URLs, titles).
// Structural chars (newlines, *, backticks, parens, brackets) are kept as-is.
function escapeMd(text: string): string {
  return text.replace(/[_\\[\]()~`>#+\-=|{}.]/g, '\\$&')
}

// Drop fragment/doc open id; preserve downloadable view.
function redactDriveUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const lo = raw.toLowerCase()
  if (!lo.includes('drive.google.com') && !lo.includes('docs.google.com')) return raw
  try {
    const u = new URL(raw)
    u.hash = ''
    if (u.pathname === '/open') u.pathname = '/file/d'
    if (u.searchParams.has('id')) {
      const id = u.searchParams.get('id')
      u.pathname = `/file/d/${encodeURIComponent(id!)}/view`
      u.search = ''
    }
    return u.toString()
  } catch {
    return raw
  }
}

function renderVideoUrl(raw: string | null | undefined): string {
  const url = redactDriveUrl(raw)
  if (url) return `[▶️ Xem video / Watch video](${escapeMd(url)})`
  return '(Video URL chưa có / missing)'
}

function captionFor(count: number): string {
  if (count === 1) return 'kết quả / result'
  return 'kết quả / results'
}

// ---------------------------------------------------------------------------
// /results [campaignId]
// - No ID   → recent completed campaigns (up to 5), scoped to linked user
// - With ID → single lookup (ownership enforced via user_id)
// ---------------------------------------------------------------------------
export async function handleResults(chatId: string, campaignId?: string): Promise<void> {
  try {
    const userId = await resolveUserId(chatId)
    if (!userId) {
      await sendMessage(
        chatId,
        "⚠️ *Chưa liên kết tài khoản*\n\n" +
          "Gõ `/email <email@cuaban.com>` để liên kết tài khoản Sophia của bạn.\n\n" +
          "⚠️ _Account not linked_.\n\n" +
          "Run `/email your@email.com` to link your Sophia account.",
      )
      return
    }

    const d1 = db()

    let rows: CampaignRow[] = []
    if (campaignId) {
      const { data } = await d1
        .from('campaigns')
        .select('id, title, video_url, updated_at, status, user_id')
        .eq('id', campaignId)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const row = (data as unknown as CampaignRow | null) ?? null
      if (!row) {
        await sendMessage(
          chatId,
          '📭 *Không tìm thấy kết quả / No results found*\n\n' +
            'ID không hợp lệ hoặc không thuộc tài khoản này.\n' +
            '_Invalid ID or this campaign does not belong to your linked account._',
        )
        return
      }
      rows = [row]
    } else {
      const { data } = await d1
        .from('campaigns')
        .select('id, title, video_url, updated_at, status, user_id')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(5)

      rows = ((data as CampaignRow[] | null) ?? []).filter((r) => r.status === 'completed')
    }

    if (rows.length === 0) {
      await sendMessage(
        chatId,
        'ℹ️ *Chưa có kết quả / No results yet*\n\n' +
          "Tạo chiến dịch với `/campaign <chủ đề>` rồi đợi AI render video xong.\n" +
          '_Create one with `/campaign <topic>` and wait for AI to render the video._',
      )
      return
    }

    
    const body = rows
      .map(
        (c, i) =>
          `${i + 1}. 🎬 *${escapeMd(c.title)}*\n` +
          `${renderVideoUrl(c.video_url)}\n` +
          ` Cập nhật / Updated: ${new Date(c.updated_at).toLocaleDateString()}`,
      )
      .join('\n\n')

    const n = rows.length
    await sendMessage(
      chatId,
      `✅ *${n} ${captionFor(n)} / ${n} ${captionFor(n)}*:\n\n` + body,
    )
  } catch (error) {
    logger.error('[telegram-results]', error instanceof Error ? error : new Error(String(error)))
    await sendMessage(
      chatId,
      '❌ Không thể đọc kết quả. Vui lòng thử lại sau.\n\n' +
        '❌ _Failed to fetch results. Try again later._',
    )
  }
}
