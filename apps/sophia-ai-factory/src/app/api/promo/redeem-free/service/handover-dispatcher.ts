/**
 * Promo Handover Dispatcher & Email Builder
 *
 * Layer: app/api/promo/redeem-free/service
 */

import { sendEmail } from '@/tree/email/sender';
import { sendHandoverTelegramDm } from '@/tree/telegram/telegram-handover-notifier';
import { createServerClient } from '@/seed/db/client';
import type { Tier } from '@/seed/types';
import { logger } from '@/seed/utils/logger-utility';

export function buildMagicLinkEmail(opts: {
  magicLink: string;
  displayName: string;
  isVi: boolean;
}): string {
  const { magicLink, displayName, isVi } = opts;
  const greeting = isVi ? `Xin chào ${displayName},` : `Hi ${displayName},`;
  const body = isVi
    ? 'Mã <strong>FREE100</strong> đã được kích hoạt thành công. Nhấn nút bên dưới để vào dashboard MASTER của bạn:'
    : 'Your <strong>FREE100</strong> code has been activated. Click the button below to access your MASTER dashboard:';
  const cta = isVi ? 'Vào Dashboard ngay' : 'Go to Dashboard';
  const expire = isVi
    ? 'Link có hiệu lực trong 72 giờ và chỉ dùng được 1 lần.'
    : 'This link is valid for 72 hours and is single-use.';
  const footer = isVi
    ? 'Nếu bạn không yêu cầu điều này, vui lòng bỏ qua email.'
    : 'If you did not request this, you can safely ignore this email.';

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0a0a0a;color:#e4e4e7;padding:32px;max-width:520px;margin:auto">
<p style="font-size:15px;margin-bottom:8px">${greeting}</p>
<p style="font-size:15px;margin-bottom:24px">${body}</p>
<a href="${magicLink}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">${cta}</a>
<p style="font-size:12px;color:#71717a;margin-top:24px">${expire}</p>
<hr style="border:none;border-top:1px solid #27272a;margin:20px 0">
<p style="font-size:11px;color:#52525b">${footer}</p>
</body></html>`;
}

export interface DispatchHandoverNotificationsOptions {
  userId: string;
  email: string;
  fullName?: string;
  magicLink: string;
  locale?: string;
  tier?: string;
  fallbackTier?: string;
}

export function dispatchHandoverNotifications({
  userId,
  email,
  fullName,
  magicLink,
  locale,
  tier,
  fallbackTier,
}: DispatchHandoverNotificationsOptions): void {
  const isVi = (locale ?? 'vi') === 'vi';
  const subject = isVi
    ? 'FREE100 đã kích hoạt — tier MASTER của bạn đã sẵn sàng'
    : 'FREE100 redeemed — your MASTER tier is now active';
  const displayName = fullName?.trim() || email.split('@')[0];
  const html = buildMagicLinkEmail({ magicLink, displayName, isVi });

  sendEmail({ to: email, subject, html })
    .then((r) => {
      if (!r.success) {
        logger.warn('[RedeemFree] Magic-link email failed (non-fatal)', { error: r.error, email });
      } else {
        logger.info('[RedeemFree] Magic-link email sent', { messageId: r.messageId, email });
      }
    })
    .catch(() => {
      /* non-fatal */
    });

  (async () => {
    try {
      const db = createServerClient();
      const paired = await db
        .from('telegram_paired_chats')
        .select('chat_id')
        .eq('paired_by', userId)
        .limit(1)
        .single();
      const chatId = paired?.data?.chat_id;
      if (chatId) {
        const tierToSend = (tier ?? fallbackTier ?? 'MASTER') as Tier;
        sendHandoverTelegramDm(String(chatId), magicLink, tierToSend).catch(() => {
          /* non-fatal — already logged inside */
        });
      }
    } catch (err) {
      logger.warn(
        '[RedeemFree] Telegram DM lookup failed (non-fatal)',
        err instanceof Error ? err : undefined
      );
    }
  })();
}
