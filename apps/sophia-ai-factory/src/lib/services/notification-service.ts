import { bot } from '@/lib/telegram/telegram-bot-instance'
import { Tier } from '@/types'

/**
 * Telegram notification service for subscription lifecycle events
 */

async function sendNotification(
  chatId: string,
  text: string
): Promise<void> {
  try {
    await bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' })
  } catch (error) {
    console.error(`[Notification] Failed to send to ${chatId}:`, error)
  }
}

/**
 * Notify user that subscription was activated
 */
export async function notifySubscriptionActivated(
  chatId: string,
  tier: Tier
): Promise<void> {
  const tierNames: Record<Tier, string> = {
    BASIC: 'Starter',
    PREMIUM: 'Growth',
    ENTERPRISE: 'Premium',
    MASTER: 'Master',
  }

  await sendNotification(
    chatId,
    `🎉 *Subscription Activated!*

Your *${tierNames[tier]}* plan is now active.

You now have access to:
• AI-powered trend discovery
• Campaign automation
• Export reports

Get started with /discover or /campaign`
  )
}

/**
 * Notify user that subscription was cancelled
 */
export async function notifySubscriptionCancelled(
  chatId: string,
  periodEnd: string | null
): Promise<void> {
  const endDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'soon'

  await sendNotification(
    chatId,
    `😢 *Subscription Cancelled*

Your access will remain active until *${endDate}*.

After that, you'll have a 7-day grace period.

To resubscribe: /subscribe`
  )
}

/**
 * Notify user that subscription is expiring soon
 */
export async function notifySubscriptionExpiring(
  chatId: string,
  daysRemaining: number
): Promise<void> {
  await sendNotification(
    chatId,
    `⏰ *Subscription Expiring Soon*

Your subscription expires in *${daysRemaining} day${daysRemaining === 1 ? '' : 's'}*.

Renew now to keep your premium features: /subscribe`
  )
}

/**
 * Notify user that subscription has expired
 */
export async function notifySubscriptionExpired(
  chatId: string
): Promise<void> {
  await sendNotification(
    chatId,
    `❌ *Subscription Expired*

Your premium access has ended.

To continue using premium features, resubscribe: /subscribe`
  )
}
