import { checkRateLimit } from './telegram-rate-limit-middleware'
import { formatRateLimitMessage } from './telegram-message-formatter'
import { sendMessage } from './handlers/utils'

// Re-export all modular handlers
export { handleStart } from './handlers/start-handler'
export { handleHelp } from './handlers/help-handler'
export { handleSubscribe } from './handlers/subscribe-handler'
export { handleDiscover } from './handlers/discover-handler'
export { handleEmail } from './handlers/email-handler'
export { handleCampaign } from './handlers/campaign-handler'
export { handleStatus } from './handlers/status-handler'
export { handleResults } from './handlers/results-handler'
export { handleCallbackQuery } from './handlers/callback-query-handler'
export { handleTextMessage, handleUnknown } from './handlers/text-message-handler'
export { handleTicket } from './handlers/ticket-handler'
export { handleMissions } from './handlers/missions-handler'

/**
 * Middleware wrapper - checks rate limit before executing handler
 */
export async function withMiddleware(
  chatId: string,
  handler: () => Promise<void>
): Promise<void> {
  // Rate limit check
  const rateLimit = await checkRateLimit(chatId)
  if (!rateLimit.allowed) {
    await sendMessage(chatId, formatRateLimitMessage(rateLimit.resetInSeconds))
    return
  }
  await handler()
}
