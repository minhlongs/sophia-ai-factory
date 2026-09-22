/**
 * Interactive qualification inline keyboards for Telegram Bot
 * Milestone M2 (Requirement R2)
 * Layer: tree (reusable UI builders, imports only seed & tree)
 * @module tree/telegram/telegram-lead-keyboards
 */

import type { InlineKeyboardMarkup } from './telegram-client';

/**
 * Niche selection keyboard
 * Options: AI Automation, E-commerce, Solopreneur, Other
 */
export function buildNicheSelectionKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🤖 AI Automation / Agency', callback_data: 'lead_niche:ai_agency' },
        { text: '🛒 E-commerce / Dropship', callback_data: 'lead_niche:ecommerce' },
      ],
      [
        { text: '💼 Solopreneur / Coaching', callback_data: 'lead_niche:solopreneur' },
        { text: '🌐 Other / Khác', callback_data: 'lead_niche:other' },
      ],
    ],
  };
}

/**
 * Budget selection keyboard
 * Options: <$500, $500–$2,000, >$2,000
 */
export function buildBudgetSelectionKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🥉 < $500 / tháng (Giai đoạn thử nghiệm)', callback_data: 'lead_budget:low' }],
      [{ text: '🥈 $500 – $2,000 / tháng (Giai đoạn tăng trưởng)', callback_data: 'lead_budget:mid' }],
      [{ text: '🥇 > $2,000 / tháng (Quy mô doanh nghiệp / Agency)', callback_data: 'lead_budget:high' }],
    ],
  };
}

/**
 * Action keyboard after sample demo delivery
 */
export function buildDemoActionKeyboard(videoUrl?: string): InlineKeyboardMarkup {
  const firstRow = videoUrl
    ? [{ text: '🎬 Watch Sample Video Demo', url: videoUrl }]
    : [{ text: '🎬 Watch Sample Video Demo', callback_data: 'lead_action:watch_demo' }];

  return {
    inline_keyboard: [
      firstRow,
      [{ text: '🚀 Get Starter ($99) - SOLO100', callback_data: 'lead_action:get_starter' }],
      [
        { text: '💳 Pay with VietQR', callback_data: 'checkout_pay:payos:BASIC:SOLO100' },
        { text: '🪙 Pay with USDT', callback_data: 'checkout_pay:nowpayments:BASIC:SOLO100' },
      ],
      [{ text: '💬 Chat with Founder', callback_data: 'lead_action:chat_founder' }],
    ],
  };
}

/**
 * Greeting keyboard when cold traffic lands on bot
 */
export function buildGreetingKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🎯 Khảo sát & Nhận Demo (1 phút)', callback_data: 'lead_action:start_survey' }],
      [{ text: '🎬 Xem Video Demo Ngay', callback_data: 'lead_action:watch_demo' }],
      [{ text: '🚀 Nhận Ưu Đãi SOLO100 ($99/tháng)', callback_data: 'lead_action:get_starter' }],
    ],
  };
}

/**
 * Checkout trigger keyboard with direct links and action buttons
 */
export function buildCheckoutKeyboard(options?: {
  nowpaymentsUrl?: string;
  payosUrl?: string;
  founderUsername?: string;
}): InlineKeyboardMarkup {
  const rows = [];

  if (options?.payosUrl) {
    rows.push([{ text: '💳 Pay with VietQR (PayOS) - 2.475.000đ', url: options.payosUrl }]);
  } else {
    rows.push([{ text: '💳 Pay with VietQR - 2.475.000đ', callback_data: 'checkout_pay:payos:BASIC:SOLO100' }]);
  }

  if (options?.nowpaymentsUrl) {
    rows.push([{ text: '🪙 Pay with USDT (NOWPayments) - 99 USDT', url: options.nowpaymentsUrl }]);
  } else {
    rows.push([{ text: '🪙 Pay with USDT - 99 USDT', callback_data: 'checkout_pay:nowpayments:BASIC:SOLO100' }]);
  }

  const founderUrl = options?.founderUsername
    ? `https://t.me/${options.founderUsername.replace('@', '')}`
    : 'https://t.me/minhlongdo';

  rows.push([{ text: '💬 Chat with Founder', url: founderUrl }]);

  return {
    inline_keyboard: rows,
  };
}
