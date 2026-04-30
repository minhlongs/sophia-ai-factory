/**
 * Onboarding Video Email — delivery notification for completed onboarding videos
 */

import { createServerClient } from '@/lib/db/client';
import { sendEmail } from '@/lib/email/sender';
import { logger } from '@/lib/utils/logger-utility';

const BRAND_COLOR = '#6750A4';

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
}

function onboardingVideoReadyEmailHtml(userName: string, dashboardUrl: string): string {
  const base = getBaseUrl();
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:${BRAND_COLOR}">Video giới thiệu của bạn đã sẵn sàng!</h2>
<p>Xin chào ${userName},</p>
<p>Video onboarding chào mừng bạn đến với Sophia AI Factory đã hoàn tất.</p>
<div style="background:#f5f5f5;padding:24px;border-radius:12px;text-align:center;margin:24px 0;">
<p style="margin:0;font-size:16px;font-weight:600;">Xem video của bạn ngay trên Dashboard</p>
</div>
<a href="${dashboardUrl}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">Xem Video</a>
<p style="margin-top:24px;font-size:14px;color:#666;">Hoặc truy cập ${dashboardUrl} để xem và tải video.</p>
<p style="margin-top:16px;">Câu hỏi? Reply email này hoặc chat với chúng tôi qua Telegram <a href="https://t.me/Sophia_Bbot" style="color:${BRAND_COLOR}">@Sophia_Bbot</a>.</p>
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e0e0e0;font-size:12px;color:#666;">
<p>Sophia AI Factory — Robot-as-a-Service Platform</p>
<p><a href="${base}" style="color:${BRAND_COLOR}">Sophia AI Factory</a></p>
</div>
</body></html>`;
}

export async function sendOnboardingVideoEmail(
  userId: string,
  videoId: string,
  _videoUrl?: string,
): Promise<boolean> {
  try {
    const db = createServerClient();

    // Get user email
    const { data: user } = await db.from('user').select('email, name').eq('id', userId).single() as { data: { email: string; name: string } | null };
    if (!user?.email) {
      logger.warn('[OnboardingEmail] No user email found', { userId });
      return false;
    }

    const dashboardUrl = `${getBaseUrl()}/dashboard/videos/${videoId}`;
    const userName = user.name || user.email.split('@')[0] || 'there';

    const result = await sendEmail({
      to: user.email,
      subject: 'Video giới thiệu Sophia AI của bạn đã sẵn sàng!',
      html: onboardingVideoReadyEmailHtml(userName, dashboardUrl),
    });

    if (result.success && result.provider !== 'dry-run') {
      await db.from('video_onboarding_events')
        .update({ delivery_status: 'email_sent', email_sent_at: Math.floor(Date.now() / 1000) })
        .eq('video_id', videoId);
      logger.info('[OnboardingEmail] Sent', { userId, videoId, messageId: result.messageId });
      return true;
    }

    if (result.provider === 'dry-run') {
      logger.warn('[OnboardingEmail] Dry-run — email NOT sent (missing RESEND_API_KEY)', { userId, videoId });
    }
    logger.warn('[OnboardingEmail] Send failed', { userId, videoId, error: result.error });
    return false;
  } catch (err) {
    logger.error('[OnboardingEmail] Error', err instanceof Error ? err : undefined, { userId, videoId });
    return false;
  }
}
