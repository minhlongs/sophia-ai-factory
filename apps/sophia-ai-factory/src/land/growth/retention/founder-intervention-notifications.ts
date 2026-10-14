/**
 * Email, Telegram, and Audit Log Dispatch Helpers for Founder 1-Click Intervention.
 * @module land/growth/retention/founder-intervention-notifications
 */

import { getD1 } from '@/seed/db/client';
import { sendEmail } from '@/tree/email/sender';
import { logger } from '@/seed/utils/logger-utility';
import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { escapeHtml, escapeTelegramMarkdown } from './constants';

export async function sendFounderCareEmail(params: {
  userId: string;
  userEmail: string;
  userName?: string | null;
  creditsAdded: number;
  customMessage?: string;
}): Promise<boolean> {
  const { userId, userEmail, userName, creditsAdded, customMessage } = params;
  try {
    const recipientName = escapeHtml(userName || userEmail.split('@')[0]);
    const escapedNote = customMessage ? escapeHtml(customMessage) : '';
    const noteContent = escapedNote
      ? `<div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 14px; margin: 16px 0; font-style: italic; color: #065f46;">"${escapedNote}"</div>`
      : '';

    const emailRes = await sendEmail({
      to: userEmail,
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
    return emailRes.success;
  } catch (err) {
    logger.warn(
      '[CustomerRetentionService] Founder intervention email error',
      { userId, err: String(err) },
    );
    return false;
  }
}

export async function notifyFounderTelegram(params: {
  userId: string;
  userEmail: string;
  userName?: string | null;
  creditsAdded: number;
  emailSent: boolean;
  customMessage?: string;
  nowStr: string;
}): Promise<boolean> {
  const { userId, userEmail, userName, creditsAdded, emailSent, customMessage, nowStr } = params;
  try {
    const adminChatId =
      process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_FOUNDER_CHAT_ID;
    if (!adminChatId) return false;

    const escapedTgNote = customMessage
      ? escapeTelegramMarkdown(customMessage)
      : 'Standard founder care gift';
    const escapedTgName = escapeTelegramMarkdown(userName || userEmail);
    const text =
      `✅ *[FOUNDER ACTION EXECUTED]* Can thiệp giữ chân khách hàng thành công!\n\n` +
      `👤 Khách hàng: *${escapedTgName}*\n` +
      `🎁 Bonus đã tặng: *+${creditsAdded} MCU*\n` +
      `✉️ Email đã gửi: *${emailSent ? 'Yes' : 'No'}*\n` +
      `📝 Ghi chú: _${escapedTgNote}_\n` +
      `⏱️ Thời gian: ${nowStr}`;

    const tgRes = await sendTelegramMessage(adminChatId, text);
    return !!tgRes;
  } catch (err) {
    logger.warn(
      '[CustomerRetentionService] Founder telegram notification error',
      { userId, err: String(err) },
    );
    return false;
  }
}

export async function recordFounderInterventionAuditLog(params: {
  actorUserId: string;
  userId: string;
  creditsAdded: number;
  customMessage?: string;
  emailSent: boolean;
  telegramNotified: boolean;
  nowStr: string;
}): Promise<string | undefined> {
  const { actorUserId, userId, creditsAdded, customMessage, emailSent, telegramNotified, nowStr } = params;
  try {
    const db = await getD1();
    if (!db) return undefined;
    const auditLogId = crypto.randomUUID();
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
    return auditLogId;
  } catch (err) {
    logger.error(
      '[CustomerRetentionService] Recording intervention audit log failed',
      { userId, err: String(err) },
    );
    return undefined;
  }
}
