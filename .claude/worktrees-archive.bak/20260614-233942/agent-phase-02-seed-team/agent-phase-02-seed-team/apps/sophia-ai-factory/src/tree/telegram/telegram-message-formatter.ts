/**
 * Message formatter utilities for Telegram bot
 * Formats messages with Markdown for consistent bot responses
 */

/**
 * Format welcome message with subscription status
 */
export function formatWelcomeMessage(isSubscribed: boolean, tierName?: string): string {
  if (isSubscribed) {
    return `🚀 *Welcome back to Sophia AI Factory!*

Your plan: *${tierName || 'Active'}*

What would you like to do?
• /discover - Find trending products
• /campaign - Create a campaign
• /status - Check your campaigns
• /help - See all commands`
  }

  return `🚀 *Welcome to Sophia AI Factory!*

I'm your AI-powered affiliate discovery and campaign assistant.

To unlock premium features, subscribe with /subscribe

*Free features:*
• View trending products
• Basic campaign insights

*Premium features:*
• AI-powered trend discovery
• Campaign automation
• Export reports`
}

/**
 * Format subscription status message
 */
export function formatSubscriptionStatus(
  tier: string,
  isActive: boolean,
  daysRemaining: number | null
): string {
  const statusEmoji = isActive ? '✅' : '❌'
  const statusText = isActive ? 'Active' : 'Expired'

  let message = `📊 *Subscription Status*

${statusEmoji} Status: ${statusText}
📋 Plan: ${tier}`

  if (daysRemaining !== null) {
    message += `\n⏰ Days remaining: ${daysRemaining}`
  }

  if (!isActive) {
    message += '\n\n💡 Renew with /subscribe to continue using premium features.'
  }

  return message
}

/**
 * Format error message for user-friendly display
 */
export function formatErrorMessage(context: string): string {
  return `⚠️ *Something went wrong*

${context}

Please try again or contact support.
Type /help for assistance.`
}

/**
 * Format rate limit message
 */
export function formatRateLimitMessage(resetInSeconds: number): string {
  return `⏳ *Slow down!*

You're sending commands too quickly.
Please wait ${resetInSeconds} seconds before trying again.`
}

/**
 * Format premium feature gate message
 */
export function formatPremiumGateMessage(requiredTier: string): string {
  return `🔒 *Premium Feature*

This feature requires a *${requiredTier}* subscription.

Use /subscribe to upgrade your plan.`
}

/**
 * Format discovery results
 */
export function formatDiscoveryResults(
  trends: Array<{ name: string; score: number; niche: string }>
): string {
  if (trends.length === 0) {
    return '📭 No trends found. Try different filters.'
  }

  let message = '🔍 *Top Trending Products*\n\n'

  trends.forEach((trend, i) => {
    const emoji = i < 3 ? '🔥' : '📈'
    message += `${emoji} *${i + 1}.* ${trend.name}\n`
    message += `   Score: ${trend.score}/100 | Niche: ${trend.niche}\n\n`
  })

  return message
}
