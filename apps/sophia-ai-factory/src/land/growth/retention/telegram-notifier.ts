/**
 * Customer Retention Telegram Alert Notifier.
 *
 * Layer: land/growth/retention
 *
 * @module land/growth/retention/telegram-notifier
 */

import { logger } from '@/seed/utils/logger-utility';
import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { escapeTelegramMarkdown } from './constants';
import type { CustomerHealthMetrics } from './types';

/**
 * Sends anti-churn alert to founder/admin Telegram.
 */
export async function sendWinBackTelegramAlert(
  customer: CustomerHealthMetrics,
): Promise<boolean> {
  try {
    const adminChatId =
      process.env.TELEGRAM_ADMIN_CHAT_ID ||
      process.env.TELEGRAM_FOUNDER_CHAT_ID;
    if (!adminChatId) return false;

    const escapedName = escapeTelegramMarkdown(
      customer.userName || 'Unknown',
    );
    const alertText =
      `🚨 *[ANTI-CHURN GUARDIAN]* Nguy cơ khách hàng rời bỏ cao!\n\n` +
      `👤 Khách hàng: *${escapedName}* (\`${customer.userEmail}\`)\n` +
      `🆔 User ID: \`${customer.userId}\`\n` +
      `📉 Điểm Sức khỏe: *${customer.totalHealthScore}/100* (CRITICAL CHURN RISK)\n\n` +
      `📊 *Chi tiết 4 chỉ số:*\n` +
      `• Tần suất đăng nhập (Recency): *${customer.recencyScore}/25* (${customer.rawMetrics.daysSinceLastActive} ngày trước)\n` +
      `• Sản lượng video (Velocity): *${customer.velocityScore}/25* (${customer.rawMetrics.videosCreated30d} video/30 ngày)\n` +
      `• Số dư MCU (Capacity): *${customer.capacityScore}/25* (${customer.rawMetrics.creditsRemaining} MCU)\n` +
      `• Độ tin cậy render (Reliability): *${customer.reliabilityScore}/25* (${Math.round(customer.rawMetrics.renderSuccessRate * 100)}% thành công)\n\n` +
      `⚡ Đã tự động gửi email kích hoạt lại. Bấm vào Bảng điều khiển để can thiệp 1-Click: https://sophia.agencyos.network/admin/growth-analytics`;

    const tgResult = await sendTelegramMessage(adminChatId, alertText);
    return !!tgResult;
  } catch (err) {
    logger.warn('[CustomerRetentionService] win-back telegram alert failed', {
      userId: customer.userId,
      err: String(err),
    });
    return false;
  }
}
