/**
 * Promo Trial Expiry Cron — daily at 00:00 UTC
 * Finds users with expired free trials and downgrades their tier.
 * Also sends "trial ended" email with upgrade CTA.
 * Schedule: "0 0 * * *" (already registered in wrangler.jsonc)
 * @module app/api/cron/promo-trial-expiry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExpiredTrialUsers } from '@/land/promo/promo-repo';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Raw } from '@/seed/db/client';
import { Resend } from 'resend';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

const CRON_NAME = 'promo-trial-expiry';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

async function downgradeExpiredTrial(db: D1Database, userId: string): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const now = new Date().toISOString();

  // Expire subscription
  await db
    .prepare(
      `UPDATE subscriptions SET status = 'expired', trial_ends_at = NULL, updated_at = ?1 WHERE user_id = ?2 AND trial_ends_at IS NOT NULL`,
    )
    .bind(nowSec, userId)
    .run();

  // Downgrade org plan to 'basic' so tier gates take effect
  const orgRow = await db
    .prepare(`SELECT org_id FROM org_members WHERE user_id = ?1 LIMIT 1`)
    .bind(userId)
    .first<{ org_id: string }>();
  if (orgRow?.org_id) {
    await db
      .prepare(`UPDATE organizations SET plan = 'basic', updated_at = ?1 WHERE id = ?2`)
      .bind(now, orgRow.org_id)
      .run();
  }
}

async function getTrialEndingSoon(db: D1Database, nowSec: number, daysAhead: number): Promise<{ user_id: string; email: string | null }[]> {
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

async function sendTrialEndedEmail(email: string): Promise<void> {
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

async function sendTrialWarningEmail(email: string, daysLeft: number): Promise<void> {
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

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const nowSec = Math.floor(Date.now() / 1000);
  let expired = 0;
  let warned = 0;
  let failed = 0;

  try {
    const db = await getD1Raw();

    // 1. Downgrade expired trials
    const expiredUsers = await getExpiredTrialUsers(nowSec);
    logger.info(`[${CRON_NAME}] Found ${expiredUsers.length} expired trials`);

    for (const { user_id, email } of expiredUsers) {
      try {
        await downgradeExpiredTrial(db, user_id);
        if (email) await sendTrialEndedEmail(email);
        expired++;
      } catch (err) {
        failed++;
        logger.error(`[${CRON_NAME}] Failed for user`, err instanceof Error ? err : undefined, { user_id });
      }
    }

    // 2. Send warning emails 3 days before expiry
    const endingSoon = await getTrialEndingSoon(db, nowSec, 3);
    for (const { email } of endingSoon) {
      try {
        if (email) {
          await sendTrialWarningEmail(email, 3);
          warned++;
        }
      } catch (err) {
        logger.warn(`[${CRON_NAME}] Warning email failed`, { error: String(err) });
      }
    }

    logger.info(`[${CRON_NAME}] Done`, { expired, warned, failed });
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, expired, warned, failed, cron: CRON_NAME });
  } catch (err) {
    logger.error(`[${CRON_NAME}] Fatal error`, err instanceof Error ? err : undefined);
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}
