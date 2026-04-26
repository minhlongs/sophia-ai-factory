/**
 * Email Drip Cron — sends nurture emails on day 1, 3, and 7 after user signup.
 *
 * Schedule: Daily at 04:00 UTC via Cloudflare Cron Trigger.
 * Auth: CRON_SECRET token via query param, x-cron-secret header, or x-cf-cron: true.
 * Dedup: Records each send in billing_events to prevent duplicate sends.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { sendEmail } from '@/lib/email/sender';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

export const dynamic = 'force-dynamic';

interface DripTemplate {
  daysSinceSignup: number;
  subject: string;
  templateKey: string;
}

const DRIP_TEMPLATES: DripTemplate[] = [
  { daysSinceSignup: 1, subject: 'Bạn đã tạo video đầu tiên chưa? 🎬', templateKey: 'drip_day1' },
  { daysSinceSignup: 3, subject: 'Mẹo: Tạo video nhanh hơn với Telegram Bot', templateKey: 'drip_day3' },
  { daysSinceSignup: 7, subject: 'Nâng cấp để mở khoá toàn bộ tính năng 🚀', templateKey: 'drip_day7' },
];

interface UserRow {
  id: string;
  email: string;
  name: string | null;
}

interface BillingEventRow {
  id: string;
}

function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured — allow in dev

  // P2: Accept Authorization: Bearer <CRON_SECRET> (standard CF Workers cron pattern)
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;

  const token = req.nextUrl.searchParams.get('token');
  if (token === secret) return true;

  const cronHeader = req.headers.get('x-cron-secret');
  if (cronHeader === secret) return true;

  // Cloudflare Cron Trigger sets this header
  const cfCron = req.headers.get('x-cf-cron');
  if (cfCron === 'true') return true;

  return false;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let sent = 0;
  const db = createServerClient();

  for (const drip of DRIP_TEMPLATES) {
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - drip.daysSinceSignup);

      // ±12h window so once-daily cron doesn't miss users
      const windowStart = new Date(targetDate.getTime() - 12 * 3600 * 1000).toISOString();
      const windowEnd = new Date(targetDate.getTime() + 12 * 3600 * 1000).toISOString();

      const { data: users } = await db
        .from('user')
        .select('id, email, name')
        .gte('created_at', windowStart)
        .lte('created_at', windowEnd);

      if (!users || users.length === 0) continue;

      for (const rawUser of users) {
        const user = rawUser as unknown as UserRow;
        try {
          // Dedup — skip if already sent this drip to this user
          const { data: existing } = await db
            .from('billing_events')
            .select('id')
            .eq('event_type', drip.templateKey)
            .eq('user_id', user.id)
            .limit(1);

          const existingRows = existing as BillingEventRow[] | null;
          if (existingRows && existingRows.length > 0) continue;

          const displayName = user.name || 'bạn';

          const result = await sendEmail({
            to: user.email,
            subject: drip.subject,
            html: buildDripHtml(drip.templateKey, displayName),
            tags: [{ name: 'type', value: drip.templateKey }],
          });

          // Record sent regardless of success to prevent infinite retry on provider error
          await db.from('billing_events').insert({
            user_id: user.id,
            event_type: drip.templateKey,
            event_category: 'marketing',
            event_data: { emailSent: result.success, provider: result.provider },
          });

          if (result.success) {
            sent++;
          } else {
            logger.warn(`[email-drip] Send failed for user ${user.id}: ${result.error}`);
          }
        } catch (e) {
          logger.error(`[email-drip] Failed for user ${user.id}`, toError(e));
        }
      }
    } catch (e) {
      logger.error(`[email-drip] Drip ${drip.templateKey} query failed`, toError(e));
    }
  }

  logger.info(`[email-drip] Completed. sent=${sent}`);
  return NextResponse.json({ success: true, sent });
}

function buildDripHtml(templateKey: string, name: string): string {
  const base = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">`;
  const footer = `<hr style="margin:24px 0;border:none;border-top:1px solid #eee"/><p style="font-size:12px;color:#999">Sophia AI Factory — sophia.agencyos.network</p></div>`;

  switch (templateKey) {
    case 'drip_day1':
      return (
        `${base}` +
        `<h2>Chào ${name}! 👋</h2>` +
        `<p>Bạn đã sẵn sàng tạo video AI đầu tiên chưa?</p>` +
        `<p>Chỉ cần 3 bước:</p>` +
        `<ol><li>Thiết lập API Keys (2 phút)</li><li>Nhấn "Tạo Chiến Dịch"</li><li>Đợi 5 phút — video tự động hoàn thành!</li></ol>` +
        `<p><a href="https://sophia.agencyos.network/vi/dashboard" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">Vào Dashboard</a></p>` +
        `${footer}`
      );
    case 'drip_day3':
      return (
        `${base}` +
        `<h2>${name}, bạn biết chưa? 📱</h2>` +
        `<p>Bạn có thể tạo video ngay trên điện thoại qua Telegram Bot!</p>` +
        `<p>Tìm <strong>@Sophia_Bbot</strong> trên Telegram → nhấn START → gõ <code>/campaign chủ đề video</code></p>` +
        `<p>Bot hoạt động 24/7 và thông báo khi video xong.</p>` +
        `<p><a href="https://t.me/Sophia_Bbot" style="background:#0088cc;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">Mở Telegram Bot</a></p>` +
        `${footer}`
      );
    case 'drip_day7':
      return (
        `${base}` +
        `<h2>${name}, sẵn sàng scale? 🚀</h2>` +
        `<p>Sau 1 tuần sử dụng, đây là lúc để mở khoá sức mạnh thật sự:</p>` +
        `<ul>` +
        `<li><strong>Growth ($399/tháng)</strong> — 50 chiến dịch, 3 kênh YouTube, API access</li>` +
        `<li><strong>Premium ($799/tháng)</strong> — Không giới hạn, tích hợp tuỳ chỉnh</li>` +
        `</ul>` +
        `<p><a href="https://sophia.agencyos.network/vi/pricing" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">Xem Bảng Giá</a></p>` +
        `${footer}`
      );
    default:
      return `${base}<p>Chào ${name}!</p>${footer}`;
  }
}
