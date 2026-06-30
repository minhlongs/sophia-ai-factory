/**
 * Message formatter utilities for Telegram bot
 * Formats messages with MarkdownV2 for consistent bot responses
 *
 * Wave 20 Phase 01 (7A): all user-provided values are escaped with escapeMarkdownV2
 * to prevent MarkdownV2 parse failures. Formatting syntax (*bold*, _italic_)
 * is preserved in template strings.
 */

import { escapeMarkdownV2 } from '@/tree/telegram/format-markdown-v2';

/**
 * Format welcome message with subscription status
 */
export function formatWelcomeMessage(isSubscribed: boolean, tierName?: string): string {
  const safeTier = tierName ? escapeMarkdownV2(tierName) : 'Active';
  if (isSubscribed) {
    return `🚀 *Welcome back to Sophia AI Factory!*

Your plan: *${safeTier}*

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
  const safeTier = escapeMarkdownV2(tier);

  let message = `📊 *Subscription Status*

${statusEmoji} Status: ${statusText}
📋 Plan: ${safeTier}`

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
 * User-provided context is escaped for MarkdownV2 safety.
 */
export function formatErrorMessage(context: string): string {
  const safeContext = escapeMarkdownV2(context);
  return `⚠️ *Something went wrong*

${safeContext}

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
  const safeTier = escapeMarkdownV2(requiredTier);
  return `🔒 *Premium Feature*

This feature requires a *${safeTier}* subscription.

Use /subscribe to upgrade your plan.`
}

/**
 * Format discovery results
 * User-provided trend names are escaped for MarkdownV2 safety.
 */
export function formatDiscoveryResults(
  trends: Array<{ name: string; score: number; niche: string }>
): string {
  if (trends.length === 0) {
    return '📭 No trends found. Try different filters.'
  }

  let message = '🔍 *Top Trending Products*\n\n'

  trends.forEach((trend, i) => {
    const safeName = escapeMarkdownV2(trend.name);
    const safeNiche = escapeMarkdownV2(trend.niche);
    const emoji = i < 3 ? '🔥' : '📈'
    message += `${emoji} *${i + 1}.* ${safeName}\n`
    message += `   Score: ${trend.score}/100 | Niche: ${safeNiche}\n\n`
  })

  return message
}
