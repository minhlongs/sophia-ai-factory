import { sendMessage } from '@/tree/telegram/handlers/utils'

/**
 * Handle /help command
 * Shows available commands and support information
 */
export async function handleHelp(chatId: string): Promise<void> {
  await sendMessage(
    chatId,
    `📚 *Available Commands:*

/start - Start fresh conversation
/help - Show this help message
/subscribe - Subscribe to premium plan
/discover - Find trending products
/email <your@email.com> - Link your Sophia account
/campaign <topic> - Create new campaign
/status - Check campaign status
/results - View campaign results
/ticket <mô tả> - Gửi yêu cầu hỗ trợ

*Need support?* Contact us at support@mekongmind.com`
  )
}
