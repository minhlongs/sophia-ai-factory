/**
 * Edge-native Telegram Admin / Founder Notifier Service
 * Sends instant alerts on lead qualification (>= 70 score) and payment completions.
 * Layer: tree (reusable Telegram integration, imports only seed & tree)
 * @module tree/telegram/telegram-admin-notifier
 */

import { logger } from '@/seed/utils/logger-utility';
import type { LeadAlertPayload, PaymentAlertPayload } from '@/seed/types/telegram-sales';
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  type InlineKeyboardMarkup,
} from './telegram-client';

function getAdminChatId(): string | null {
  return (
    process.env.TELEGRAM_ADMIN_CHAT_ID ||
    process.env.TELEGRAM_FOUNDER_CHAT_ID ||
    null
  );
}

function getNicheDisplayName(niche: string): string {
  const map: Record<string, string> = {
    ai_agency: '🤖 AI Agency / Automation',
    ecommerce: '🛒 E-commerce / Dropshipping',
    solopreneur: '💼 Solopreneur / Coaching',
    real_estate: '🏠 Real Estate / BĐS',
    beauty: '💄 Beauty & Fashion',
    other: '🌐 Other / Khác',
  };
  return map[niche] || niche;
}

function getBudgetDisplayName(budget: string): string {
  const map: Record<string, string> = {
    low: '< $500 / tháng (Test)',
    mid: '$500 – $2,000 / tháng (Grow)',
    high: '> $2,000 / tháng (Scale)',
  };
  return map[budget] || budget;
}

export function formatLeadQualifiedAlert(lead: LeadAlertPayload): string {
  const nicheLabel = getNicheDisplayName(lead.niche);
  const budgetLabel = getBudgetDisplayName(String(lead.budgetTier));
  const intentTag = lead.leadScore >= 70 ? '🔥 HIGH INTENT' : '🌱 Qualified';
  const usernameTag = lead.username ? ` (@${lead.username})` : '';

  return (
    `🎯 *[SOPHIA LEAD] Khách hàng tiềm năng mới!* (${intentTag})\n\n` +
    `👤 Người dùng: *${lead.firstName}*${usernameTag}\n` +
    `🆔 Telegram Chat ID: \`${lead.chatId}\`\n` +
    `🏷️ Lĩnh vực: *${nicheLabel}*\n` +
    `💰 Ngân sách: *${budgetLabel}*\n` +
    `📈 Điểm tiềm năng: *${lead.leadScore}/100*\n` +
    `📍 Nguồn: *${lead.sourceUtm || lead.campaignId || 'Direct viral link'}*\n` +
    `⏱️ Thời gian: ${new Date().toISOString()}`
  );
}

export function formatPaymentSuccessAlert(payment: PaymentAlertPayload): string {
  const amountVndStr = payment.amountVnd
    ? ` (+${payment.amountVnd.toLocaleString('vi-VN')} VNĐ)`
    : '';
  const emailStr = payment.email ? ` (${payment.email})` : '';
  const promoStr = payment.promoCode ? payment.promoCode : 'N/A';
  const orderStr = payment.orderId ? `\n🧾 Mã đơn hàng: \`${payment.orderId}\`` : '';

  const targetMrr = 5000;
  const currentMrr = payment.currentMrr ?? payment.amountUsd;
  const percent = Math.min(100, Math.round((currentMrr / targetMrr) * 100));
  const filledBlocks = Math.min(10, Math.floor(percent / 10));
  const emptyBlocks = 10 - filledBlocks;
  const progressBar = '▓'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

  return (
    `🎉🎉 *[SOPHIA REVENUE] TING TING! THANH TOÁN THÀNH CÔNG!* 🚀\n\n` +
    `💰 Doanh thu: *+${payment.amountUsd} USD*${amountVndStr}\n` +
    `👤 Khách hàng: *${payment.customerName}*${emailStr}\n` +
    `📦 Gói kích hoạt: *${payment.tier}*\n` +
    `🎟️ Mã ưu đãi: *${promoStr}*\n` +
    `🏦 Cổng thanh toán: *${payment.provider.toUpperCase()}*\n` +
    `🆔 Mã giao dịch: \`${payment.paymentId}\`${orderStr}\n\n` +
    `🏁 *Tiến độ $5,000 MRR Goal:*\n` +
    `[${progressBar}] *$${currentMrr.toLocaleString()} / $5,000* (${percent}%)\n` +
    `Khách hàng trả phí: #${payment.customerIndex ?? 1} / 10 khách đầu tiên!`
  );
}

/**
 * Sends a notification to the founder/admin when a lead is qualified (score >= 70).
 * Safe, non-blocking fire-and-forget.
 */
export async function notifyFounderLeadQualified(lead: LeadAlertPayload): Promise<void> {
  const adminChatId = getAdminChatId();
  if (!adminChatId) {
    logger.warn('[telegram-admin-notifier] Neither TELEGRAM_ADMIN_CHAT_ID nor TELEGRAM_FOUNDER_CHAT_ID configured');
    return;
  }

  // Filter for qualification threshold if leadScore is provided
  if (lead.leadScore < 70) {
    logger.info('[telegram-admin-notifier] Lead score below threshold, skipping alert', {
      chatId: lead.chatId,
      score: lead.leadScore,
    });
    return;
  }

  try {
    const text = formatLeadQualifiedAlert(lead);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: '💬 Nhắn tin khách ngay', url: `tg://user?id=${lead.chatId}` },
          { text: '📊 CRM Analytics', url: `${appUrl}/admin/growth-analytics` },
        ],
      ],
    };

    await sendTelegramMessageWithKeyboard(adminChatId, text, keyboard);
    logger.info('[telegram-admin-notifier] Qualified lead alert sent to admin', {
      adminChatId,
      leadChatId: lead.chatId,
      score: lead.leadScore,
    });
  } catch (err) {
    logger.error('[telegram-admin-notifier] Failed to send qualified lead alert', {
      error: err instanceof Error ? err.message : String(err),
      chatId: lead.chatId,
    });
  }
}

/**
 * Sends a celebration notification to founder/admin on payment completion.
 * Safe, non-blocking fire-and-forget.
 */
export async function notifyFounderPaymentSuccess(payment: PaymentAlertPayload): Promise<void> {
  const adminChatId = getAdminChatId();
  if (!adminChatId) {
    logger.warn('[telegram-admin-notifier] Admin chat ID not configured — payment alert skipped');
    return;
  }

  try {
    const text = formatPaymentSuccessAlert(payment);
    await sendTelegramMessage(adminChatId, text);
    logger.info('[telegram-admin-notifier] Payment alert sent to admin', {
      adminChatId,
      paymentId: payment.paymentId,
      amountUsd: payment.amountUsd,
    });
  } catch (err) {
    logger.error('[telegram-admin-notifier] Failed to send payment alert', {
      error: err instanceof Error ? err.message : String(err),
      paymentId: payment.paymentId,
    });
  }
}

// Aliases for unified naming convention
export const notifyAdminLeadQualified = notifyFounderLeadQualified;
export const notifyAdminPaymentSuccess = notifyFounderPaymentSuccess;
