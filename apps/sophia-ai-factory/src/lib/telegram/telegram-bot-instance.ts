import { Telegraf } from 'telegraf'

const token = process.env.TELEGRAM_BOT_TOKEN || 'dummy_token_for_build'

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn('TELEGRAM_BOT_TOKEN is not defined. Telegram bot functionality will be disabled.')
}

/**
 * Singleton Telegram bot instance
 * Used for processing updates via webhook
 */
export const bot = new Telegraf(token)

// Disable polling since we're using webhooks
if (process.env.TELEGRAM_BOT_TOKEN) {
    bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {
    // Ignore errors on initialization
    })
}
