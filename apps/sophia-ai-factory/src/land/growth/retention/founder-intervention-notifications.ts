/**
 * Email, Telegram, and Audit Log Dispatch Helpers for Founder 1-Click Intervention.
 * @module land/growth/retention/founder-intervention-notifications
 */

import { getD1 } from '@/seed/db/client';
import { sendEmail } from '@/tree/email/sender';
import { logger } from '@/seed/utils/logger-utility';
import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import {
  buildFounderCareEmailHtml,
  buildFounderTelegramText,
} from './founder-intervention-templates';

export async function sendFounderCareEmail(params: {
  userId: string;
  userEmail: string;
  userName?: string | null;
  creditsAdded: number;
  customMessage?: string;
}): Promise<boolean> {
  const { userId, userEmail, userName, creditsAdded, customMessage } = params;
  try {
    const emailRes = await sendEmail({
      to: userEmail,
      subject:
        'Special Gift from Sophia AI Founder / Quà tặng đặc biệt từ Founder Sophia AI',
      html: buildFounderCareEmailHtml({
        userName,
        userEmail,
        creditsAdded,
        customMessage,
      }),
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

    const text = buildFounderTelegramText({
      userName,
      userEmail,
      creditsAdded,
      emailSent,
      customMessage,
      nowStr,
    });

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
