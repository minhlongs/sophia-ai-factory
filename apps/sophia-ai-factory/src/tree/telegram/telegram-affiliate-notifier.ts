/**
 * Telegram Affiliate Commission & Revenue Notifier
 *
 * Dispatches realtime conversion notifications and milestone alerts to CEOs
 * via @Sophia_Bbot without breaking existing bot command webhook flows.
 *
 * Layer: tree/telegram (Domain Logic)
 * @module tree/telegram/telegram-affiliate-notifier
 */

import { escapeMarkdownV2 } from './format-markdown-v2';
import { notifyUserByTelegram } from './user-notifier';
import { logger } from '@/seed/utils/logger-utility';

export interface AffiliateAlertDetails {
  productName: string;
  niche: 'saas_global' | 'crypto_global' | 'ecommerce_tiktok';
  commissionUsd: number;
  network: string;
  orderOrTxnId: string;
  subId?: string | null;
  isMilestone?: boolean;
}

/**
 * Formats a high-converting, clean MarkdownV2 commission alert for Telegram.
 */
export function formatAffiliateCommissionAlert(details: AffiliateAlertDetails): string {
  const safeProduct = escapeMarkdownV2(details.productName);
  const safeNetwork = escapeMarkdownV2(details.network.toUpperCase());
  const safeTxn = escapeMarkdownV2(details.orderOrTxnId);
  const formattedUsd = escapeMarkdownV2(`$${details.commissionUsd.toFixed(2)}`);

  const header = details.isMilestone
    ? '🏆 *REVENUE MILESTONE HIT\\!*'
    : '💸 *NEW AFFILIATE COMMISSION RECORDED\\!*';

  let msg = `${header}

📦 *Sản phẩm / Token:* ${safeProduct}
💰 *Hoa hồng nhận được:* *${formattedUsd}*
🌐 *Mạng lưới:* ${safeNetwork}
🔖 *Mã giao dịch:* \`${safeTxn}\``;

  if (details.subId) {
    const safeSubId = escapeMarkdownV2(details.subId);
    msg += `\n🎯 *Chiến dịch / SubID:* \`${safeSubId}\``;
  }

  msg += '\n\n🚀 _Hệ thống Sophia AI Factory đang tiếp tục tự động tối ưu hóa Video Hooks\\!_';

  return msg;
}

/**
 * Dispatches an instant commission alert to the user's Telegram.
 */
export async function sendAffiliateCommissionAlert(
  userId: string,
  details: AffiliateAlertDetails,
): Promise<boolean> {
  try {
    const message = formatAffiliateCommissionAlert(details);
    await notifyUserByTelegram(userId, message);
    logger.info('[sendAffiliateCommissionAlert] Alert dispatched successfully', {
      userId,
      network: details.network,
      commissionUsd: details.commissionUsd,
    });
    return true;
  } catch (error) {
    logger.warn('[sendAffiliateCommissionAlert] Failed to dispatch alert', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
