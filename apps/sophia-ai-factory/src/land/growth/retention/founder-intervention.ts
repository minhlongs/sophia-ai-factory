/**
 * Customer Retention Founder 1-Click Intervention.
 *
 * Layer: land/growth/retention
 *
 * @module land/growth/retention/founder-intervention
 */

import { getD1 } from '@/seed/db/client';
import { addCredits } from '@/tree/mcu/credits-repo';
import { sendEmail } from '@/tree/email/sender';
import { logger } from '@/seed/utils/logger-utility';
import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { getCustomerHealthMetrics } from './activity-aggregator';
import { escapeHtml, escapeTelegramMarkdown } from './constants';
import type {
  FounderInterventionRequest,
  FounderInterventionResult,
} from './types';

/**
 * 1-Click Founder Intervention:
 * Grants bonus credits and dispatches immediate high-touch founder outreach.
 */
export async function executeFounderIntervention(
  request: FounderInterventionRequest,
): Promise<FounderInterventionResult> {
  const {
    userId,
    bonusCredits = 500,
    customMessage,
    notifyEmail = true,
    notifyTelegram = true,
    actorUserId = 'founder_admin',
  } = request;
  const nowStr = new Date().toISOString();

  // 1. Fetch user to confirm existence and email
  const customer = await getCustomerHealthMetrics(userId);
  if (!customer) {
    return {
      success: false,
      userId,
      creditsAdded: 0,
      emailSent: false,
      telegramNotified: false,
      message: 'Customer not found',
      timestamp: nowStr,
    };
  }

  // 2. Atomically grant bonus MCU credits
  let creditsAdded = 0;
  if (bonusCredits > 0) {
    const success = await addCredits(
      userId,
      bonusCredits,
      'FOUNDER_WINBACK_BONUS',
      { customMessage, actorUserId, grantedAt: nowStr },
    );
    if (success) {
      creditsAdded = bonusCredits;
    } else {
      logger.error(
        '[CustomerRetentionService] Failed to grant bonus credits',
        { userId, bonusCredits },
      );
    }
  }

  // 3. Send high-touch Founder Support Email if requested
  let emailSent = false;
  if (notifyEmail && customer.userEmail) {
    try {
      const recipientName = escapeHtml(
        customer.userName || customer.userEmail.split('@')[0],
      );
      const escapedNote = customMessage ? escapeHtml(customMessage) : '';
      const noteContent = escapedNote
        ? `<div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 14px; margin: 16px 0; font-style: italic; color: #065f46;">"${escapedNote}"</div>`
        : '';

      const emailRes = await sendEmail({
        to: customer.userEmail,
        subject:
          'Special Gift from Sophia AI Founder / Quà tặng đặc biệt từ Founder Sophia AI',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #18181b;">
            <h2 style="color: #059669; margin-bottom: 16px;">🎁 Founder Care Gift: +${creditsAdded} MCU Added to Your Account</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">
              Xin chào <strong>${recipientName}</strong>,<br/><br/>
              Tôi là Founder của Sophia AI Factory. Nhận thấy bạn có thể đang gặp trở ngại trong việc tối ưu hóa nội dung video, tôi đã trực tiếp nạp thêm <strong>${creditsAdded} Model Compute Units (MCU)</strong> hoàn toàn miễn phí vào tài khoản của bạn để bạn thoải mái trải nghiệm.
            </p>
            ${noteContent}
            <p style="text-align: center; margin: 30px 0;">
              <a href="https://sophia.agencyos.network/dashboard" style="background-color: #059669; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
                Trải nghiệm ngay / Launch Sophia Factory
              </a>
            </p>
            <p style="font-size: 13px; color: #71717a;">
              Nếu bạn muốn đặt lịch 15 phút cùng tôi để cấu hình quy trình sản xuất video tự động riêng cho thương hiệu của bạn, chỉ cần phản hồi trực tiếp email này.
            </p>
          </div>
        `,
      });
      emailSent = emailRes.success;
    } catch (err) {
      logger.warn(
        '[CustomerRetentionService] Founder intervention email error',
        { userId, err: String(err) },
      );
    }
  }

  // 4. Send confirmation alert to Founder Telegram
  let telegramNotified = false;
  if (notifyTelegram) {
    try {
      const adminChatId =
        process.env.TELEGRAM_ADMIN_CHAT_ID ||
        process.env.TELEGRAM_FOUNDER_CHAT_ID;
      if (adminChatId) {
        const escapedTgNote = customMessage
          ? escapeTelegramMarkdown(customMessage)
          : 'Standard founder care gift';
        const escapedTgName = escapeTelegramMarkdown(
          customer.userName || customer.userEmail,
        );
        const text =
          `✅ *[FOUNDER ACTION EXECUTED]* Can thiệp giữ chân khách hàng thành công!\n\n` +
          `👤 Khách hàng: *${escapedTgName}*\n` +
          `🎁 Bonus đã tặng: *+${creditsAdded} MCU*\n` +
          `✉️ Email đã gửi: *${emailSent ? 'Yes' : 'No'}*\n` +
          `📝 Ghi chú: _${escapedTgNote}_\n` +
          `⏱️ Thời gian: ${nowStr}`;

        const tgRes = await sendTelegramMessage(adminChatId, text);
        telegramNotified = !!tgRes;
      }
    } catch (err) {
      logger.warn(
        '[CustomerRetentionService] Founder telegram notification error',
        { userId, err: String(err) },
      );
    }
  }

  // 5. Record intervention event to admin_audit_log
  let auditLogId: string | undefined;
  try {
    const db = await getD1();
    if (db) {
      auditLogId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO admin_audit_log (id, actor_user_id, action_type, target_user_id, payload, created_at)
         VALUES (?, ?, 'founder_retention_intervention', ?, ?, strftime('%s','now'))`,
        )
        .bind(
          auditLogId,
          actorUserId,
          userId,
          JSON.stringify({
            creditsAdded,
            customMessage,
            emailSent,
            telegramNotified,
            executedAt: nowStr,
          }),
        )
        .run();
    }
  } catch (err) {
    logger.error(
      '[CustomerRetentionService] Recording intervention audit log failed',
      { userId, err: String(err) },
    );
  }

  // 6. Recalculate health metrics after credit bonus
  const updatedCustomer = await getCustomerHealthMetrics(userId);

  return {
    success: true,
    userId,
    creditsAdded,
    emailSent,
    telegramNotified,
    auditLogId,
    message: `Successfully granted ${creditsAdded} bonus MCU and dispatched intervention`,
    timestamp: nowStr,
    updatedHealthScore: updatedCustomer?.totalHealthScore,
  };
}
