import type { InlineKeyboardButton, InlineKeyboardMarkup } from 'telegraf/types'

/**
 * Inline keyboard builder utilities for Telegram bot
 * Creates reusable keyboard layouts for bot interactions
 */

type InlineKeyboard = InlineKeyboardButton[][]

/**
 * Build main menu keyboard after subscription is active
 */
export function buildMainMenuKeyboard(): InlineKeyboard {
  return [
    [
      { text: '🔍 Discover Trends', callback_data: 'cmd:discover' },
      { text: '📝 Create Campaign', callback_data: 'cmd:campaign' },
    ],
    [
      { text: '📊 My Status', callback_data: 'cmd:status' },
      { text: '📈 Results', callback_data: 'cmd:results' },
    ],
    [{ text: '❓ Help', callback_data: 'cmd:help' }],
  ]
}

/**
 * Build subscription prompt keyboard with payment link
 */
export function buildSubscribeKeyboard(checkoutUrl: string): InlineKeyboard {
  return [
    [{ text: '💳 Subscribe Now', url: checkoutUrl }],
    [{ text: '📋 View Plans', callback_data: 'cmd:plans' }],
  ]
}

/**
 * Build pricing tier selection keyboard
 */
export function buildPricingKeyboard(): InlineKeyboard {
  return [
    [{ text: '🌱 Starter - $19/mo', callback_data: 'subscribe:starter' }],
    [{ text: '🚀 Growth - $29/mo', callback_data: 'subscribe:growth' }],
    [{ text: '💎 Premium - $49/mo', callback_data: 'subscribe:premium' }],
  ]
}

/**
 * Build discovery filter keyboard
 */
export function buildDiscoveryFilterKeyboard(): InlineKeyboard {
  return [
    [
      { text: '🌍 All Niches', callback_data: 'discover:all' },
      { text: '💻 Tech', callback_data: 'discover:tech' },
    ],
    [
      { text: '🏋️ Health', callback_data: 'discover:health' },
      { text: '💰 Finance', callback_data: 'discover:finance' },
    ],
    [
      { text: '🎓 Education', callback_data: 'discover:education' },
      { text: '🛒 E-commerce', callback_data: 'discover:ecommerce' },
    ],
    [{ text: '⬅️ Back to Menu', callback_data: 'cmd:menu' }],
  ]
}

/**
 * Build confirmation keyboard (Yes/No)
 */
export function buildConfirmationKeyboard(actionId: string): InlineKeyboard {
  return [
    [
      { text: '✅ Confirm', callback_data: `confirm:${actionId}` },
      { text: '❌ Cancel', callback_data: `cancel:${actionId}` },
    ],
  ]
}

/**
 * Build campaign export format keyboard
 */
export function buildExportFormatKeyboard(): InlineKeyboard {
  return [
    [
      { text: '📄 PDF', callback_data: 'export:pdf' },
      { text: '📊 CSV', callback_data: 'export:csv' },
      { text: '🔧 JSON', callback_data: 'export:json' },
    ],
    [{ text: '⬅️ Back', callback_data: 'cmd:menu' }],
  ]
}

/**
 * Convert InlineKeyboard to Telegram reply_markup format
 */
export function toReplyMarkup(keyboard: InlineKeyboard): InlineKeyboardMarkup {
  return { inline_keyboard: keyboard }
}
