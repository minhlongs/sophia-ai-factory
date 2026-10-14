/**
 * Email dispatchers and D1 downgrade helpers for promo-trial-expiry cron.
 * @module app/api/cron/promo-trial-expiry/promo-trial-helpers
 */

import { Resend } from 'resend';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { logger } from '@/seed/utils/logger-utility';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

export async function downgradeExpiredTrial(db: D1Database, userId: string): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const now = new Date().toISOString();

  await db
    .prepare(
      `UPDATE subscriptions SET status = 'expired', trial_ends_at = NULL, updated_at = ?1 WHERE user_id = ?2 AND trial_ends_at IS NOT NULL`,
    )
    .bind(nowSec, userId)
    .run();

  const orgId = await resolveOrgId(userId, db);
  if (orgId) {
    await db
      .prepare(`UPDATE organizations SET plan = 'basic', updated_at = ?1 WHERE id = ?2`)
      .bind(now, orgId)
      .run();
  }
}

export async function getTrialEndingSoon(
  db: D1Database,
  nowSec: number,
  daysAhead: number,
): Promise<{ user_id: string; email: string | null }[]> {
  const thresholdSec = nowSec + daysAhead * 86400;
  const { results } = await db
    .prepare(
      `SELECT s.user_id, u.email
       FROM subscriptions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.trial_ends_at IS NOT NULL
         AND s.trial_ends_at > ?1
         AND s.trial_ends_at <= ?2
         AND s.status = 'active'
       LIMIT 100`,
    )
    .bind(nowSec, thresholdSec)
    .all<{ user_id: string; email: string | null }>();
  return results ?? [];
}

export async function sendTrialEndedEmail(email: string): Promise<void> {
  const resend = getResend();
  if (!resend || !email) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
  try {
    await resend.emails.send({
      from: 'Sophia AI <noreply@mekongmind.com>',
      to: [email],
      subject: 'Your Sophia AI free trial has ended | Dùng thử Sophia AI đã kết thúc',
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#09090b;color:#e4e4e7;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto">
    <div style="background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(139,92,246,0.12));border:1px solid rgba(245,158,11,0.3);border-radius:16px;padding:32px">
      <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#f59e0b">Sophia AI Factory</h1>
      <p style="margin:0 0 16px">Hi,</p>
      <p style="margin:0 0 16px;line-height:1.6">
        Your free trial has ended. Upgrade to keep full access to AI video automation, SOPs, and campaigns.<br>
        <span style="color:#a1a1aa;font-size:13px">Thời gian dùng thử miễn phí đã kết thúc. Nâng cấp để tiếp tục sử dụng.</span>
      </p>
      <a href="${appUrl}/pricing" style="display:inline-block;background:linear-gradient(135deg,#d97706,#7c3aed);color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
        Upgrade Now / Nâng Cấp Ngay
      </a>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
      <p style="color:#a1a1aa;font-size:13px;margin:0">Support: <a href="mailto:support@mekongmind.com" style="color:#f59e0b">support@mekongmind.com</a></p>
    </div>
  </div>
</body>
</html>`,
    });
  } catch (err) {
    logger.warn('[PromoTrialExpiry] Email failed', { email, error: err instanceof Error ? err.message : String(err) });
  }
}

export async function sendTrialWarningEmail(email: string, daysLeft: number): Promise<void> {
  const resend = getResend();
  if (!resend || !email) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
  try {
    await resend.emails.send({
      from: 'Sophia AI <noreply@mekongmind.com>',
      to: [email],
      subject: `${daysLeft} days left on your Sophia AI trial | Còn ${daysLeft} ngày dùng thử`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#09090b;color:#e4e4e7;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto">
    <div style="background:linear-gradient(135deg,rgba(59,130,246,0.12),rgba(139,92,246,0.12));border:1px solid rgba(59,130,246,0.3);border-radius:16px;padding:32px">
      <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#3b82f6">Sophia AI Factory</h1>
      <p style="margin:0 0 16px">Hi,</p>
      <p style="margin:0 0 16px;line-height:1.6">
        Your free trial ends in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>. Upgrade now to keep all your AI video campaigns, SOPs, and data.<br>
        <span style="color:#a1a1aa;font-size:13px">Còn ${daysLeft} ngày dùng thử. Nâng cấp ngay để giữ tất cả chiến dịch AI video và dữ liệu.</span>
      </p>
      <a href="${appUrl}/pricing" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#7c3aed);color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
        Upgrade Now / Nâng Cấp Ngay
      </a>
    </div>
  </div>
</body>
</html>`,
    });
  } catch (err) {
    logger.warn('[PromoTrialExpiry] Warning email failed', { email, daysLeft, error: err instanceof Error ? err.message : String(err) });
  }
}
