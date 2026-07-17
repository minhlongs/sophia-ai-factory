import { createServerClient } from '@/seed/db/client'
import { sendMessage } from '@/tree/telegram/handlers/utils'
import { logger } from '@/seed/utils/logger-utility'

const db = () => createServerClient()

// ---------------------------------------------------------------------------
// /status [campaignId]
// Without ID  → list non-draft campaigns with status, scoped to linked account
// With ID     → single lookup for the requested campaign (ownership check)
// ---------------------------------------------------------------------------
export async function handleStatus(chatId: string, campaignId?: string): Promise<void> {
  try {
    const profile = db()
      .from('user_profiles')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()

    if (!(await profile).data) {
      await sendMessage(
        chatId,
        "⚠️ Tài khoản chưa liên kết. Gõ '/email <email@cuaban.com>' để liên kết trước.\n\n⚠️ _Account not linked_.\n\nPlease run `/email your@email.com` first.",
      )
      return
    }

    const uid = ((await profile).data as unknown as { user_id: string }).user_id
    const d1 = db()

    if (campaignId) {
      // Single campaign lookup, ownership enforced by user_id filter.
      const lookup = await d1
        .from('campaigns')
        .select('id, title, status, progress, created_at, updated_at')
        .eq('id', campaignId)
        .eq('user_id', uid)
        .maybeSingle()

      const row = (await lookup).data as unknown as
        | { id: string; title: string; status: string | null; progress: number | null; created_at: string; updated_at: string }
        | null
      if (!row) {
        await sendMessage(
          chatId,
          '📭 Không tìm thấy chiến dịch.\n\nID không hợp lệ hoặc không thuộc tài khoản này.\n\n📭 _Campaign not found_.\n\nInvalid ID or the campaign does not belong to your account.',
        )
        return
      }

      const emoji =
        row.status === 'completed'
          ? '✅'
          : row.status === 'failed'
            ? '❌'
            : row.status?.startsWith('processing')
              ? '⚙️'
              : '⏳'

      await sendMessage(
        chatId,
        `${emoji} *Trạng thái / Status: ${row.title}*\n\n` +
          ` ID: \`${row.id.slice(0, 8)}\`\n` +
          ` Trạng thái / Status: ${row.status ?? 'unknown'}\n` +
          ` Tiến độ / Progress: ${row.progress ?? 0}%\n` +
          ` Tạo lúc / Created: ${new Date(row.created_at).toLocaleDateString()}\n` +
          ` Cập nhật / Updated: ${new Date(row.updated_at).toLocaleDateString()}`,
      )
      return
    }

    // List semi-active campaigns (queued, processing, missing video on completed)
    const listResult = await d1
      .from('campaigns')
      .select('id, title, status, progress, created_at, updated_at')
      .eq('user_id', uid)
      .not('status', 'in', '("draft")')
      .order('created_at', { ascending: false })
      .limit(20)

    const rows = ((await listResult).data ?? []) as unknown as {
      id: string
      title: string
      status: string | null
      progress: number | null
      created_at: string
      updated_at: string
    }[]

    if (rows.length === 0) {
      await sendMessage(
        chatId,
        "📭 Chưa có chiến dịch nào. Tạo mới với '/campaign <chủ đề>'.\n\n📭 _No campaigns yet_.\n\nCreate one with `/campaign <topic>`.",
      )
      return
    }

    const statusEmoji = (s: string | null | undefined) => {
      if (s === 'queued') return '⏳'
      if (s?.startsWith('processing')) return '⚙️'
      if (s === 'completed') return '✅'
      if (s === 'failed' || s === 'video_timeout') return '❌'
      return '•'
    }

    const statusHuman = (s: string | null | undefined) => (s ?? 'unknown').replace(/_/g, ' ')

    const header = '📊 *DANH SÁCH CHIẾN DỊCH / ACTIVE CAMPAIGNS*\n\n'
    const body = rows
      .map(
        (r, idx) =>
          `${idx + 1}. ${statusEmoji(r.status)} *${r.title}*\n` +
          ` ID: \`${r.id.slice(0, 8)}\`\n` +
          ` ${statusHuman(r.status)} (${r.progress ?? 0}%)\n` +
          ` Tạo / Created: ${new Date(r.created_at).toLocaleDateString()}\n`,
      )
      .join('\n')

    await sendMessage(chatId, header + body)
  } catch (error) {
    logger.error('[telegram-status]', error instanceof Error ? error : new Error(String(error)))
    await sendMessage(
      chatId,
      '❌ Không thể đọc trạng thái. Vui lòng thử lại sau.\n\n❌ _Failed to fetch status. Try again later._',
    )
  }
}
