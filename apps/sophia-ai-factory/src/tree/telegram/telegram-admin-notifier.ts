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
import {
  formatLeadQualifiedAlert,
  formatPaymentSuccessAlert,
} from './telegram-admin-formatters';

export { formatLeadQualifiedAlert, formatPaymentSuccessAlert };

function getAdminChatId(): string | null {
  return (
    process.env.TELEGRAM_ADMIN_CHAT_ID ||
    process.env.TELEGRAM_FOUNDER_CHAT_ID ||
    null
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
