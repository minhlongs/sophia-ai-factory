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
/missions - Recent missions
/ticket <mô tả> - Gửi yêu cầu hỗ trợ

🤖 *OpenClaw tool surface (100/100):*
/version - Deploy SHA + timestamp
/tier - Tài khoản + tier hiện tại
/quota - Quota usage vs limits
/affiliate - Affiliate stats
/videos [processing|completed|failed] - Trạng thái video
/handover - Onboarding milestones
/embed <videoId|body> - Build affiliate-embedded video description
/translate <toLang> <text> - Translate via your BYOK OpenRouter key
/free100 <email> - Redeem FREE100 → MASTER magic-link

*Need support?* Contact us at support@mekongmind.com`
  )
}
