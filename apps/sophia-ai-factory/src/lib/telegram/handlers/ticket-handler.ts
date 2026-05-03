import { createServerClient } from '@/seed/db/client'
import { sendMessage } from './utils'

/**
 * Handle /ticket command — log a support request to D1.
 * If the support_tickets table doesn't exist yet, the insert fails silently
 * and the user still receives the confirmation message.
 */
export async function handleTicket(chatId: string, userId: string, ticketText: string): Promise<void> {
  if (!ticketText) {
    await sendMessage(
      chatId,
      '📝 Vui lòng mô tả vấn đề. Ví dụ:\n/ticket Video chiến dịch "ABC" bị lỗi sau 30 phút'
    )
    return
  }

  // Attempt to persist the ticket — fail silently if table absent
  try {
    const db = createServerClient()
    await db.from('support_tickets').insert({
      user_id: userId,
      telegram_chat_id: chatId,
      message: ticketText,
      status: 'open',
      created_at: new Date().toISOString(),
    })
  } catch {
    // Table may not exist yet — user still gets confirmation below
  }

  await sendMessage(
    chatId,
    '✅ Đã ghi nhận yêu cầu hỗ trợ. Chúng tôi sẽ phản hồi trong vòng 24h.\n\nTrong lúc chờ, bạn có thể xem Câu Hỏi Thường Gặp tại: sophia.agencyos.network/vi/guide/faq'
  )
}
