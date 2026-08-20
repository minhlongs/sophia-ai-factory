/**
 * POST /api/promo/redeem-free
 * Redeem a free_trial or free_full promo code.
 * Creates user if not found, fires auto-handover, returns magic link.
 * Auth optional — creates user from email if not logged in.
 * @module app/api/promo/redeem-free
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { applyPromoCode } from '@/land/promo/promo-applier';
import { validatePromoCode } from '@/land/promo/promo-validator';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getAuth } from '@/seed/auth/better-auth-server';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { getD1 } from '@/seed/db/client';
import { createCustomerUser } from '@/tree/handover/handover-account-setup';
import { sendEmail } from '@/tree/email/sender';
import { sendHandoverTelegramDm } from '@/tree/telegram/telegram-handover-notifier';
import { createServerClient } from '@/seed/db/client';
import type { Tier } from '@/seed/types';
import { logger } from '@/seed/utils/logger-utility';

const redeemFreeSchema = z.object({
  code: z.string().min(1).max(30),
  email: z.string().email(),
  fullName: z.string().min(1).max(100).optional(),
  agencyType: z.string().optional(),
  tier: z.string().optional(),
  locale: z.string().optional(),
});

async function findOrResolveUser(
  request: Request,
  email: string,
): Promise<{ userId: string | null; sessionEmailVerified: boolean }> {
  // Read full Better-Auth session to access emailVerified flag (the wrapped
  // User type from getCurrentUserFromHeaders strips it).
  try {
    const auth = await getAuth();
    if (auth) {
      const session = await auth.api.getSession({ headers: request.headers });
      const sUser = session?.user as { id?: string; emailVerified?: boolean } | undefined;
      if (sUser?.id) {
        return { userId: sUser.id, sessionEmailVerified: sUser.emailVerified === true };
      }
    }
  } catch { /* not logged in */ }
  // Fallback to legacy session helper
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (user?.id) {
      return { userId: user.id, sessionEmailVerified: false };
    }
  } catch { /* not logged in */ }

  // Look up by email in D1
  const _db = await getD1();
  if (!_db) {
    return { userId: null, sessionEmailVerified: false };
  }
  const db = _db;
  try {
    const row = await db
      .prepare(`SELECT id FROM user WHERE email = ?1 LIMIT 1`)
      .bind(email)
      .first<{ id: string }>();
    return { userId: row?.id ?? null, sessionEmailVerified: false };
  } catch {
    return { userId: null, sessionEmailVerified: false };
  }
}

/** Build bilingual HTML email for magic-link delivery. */
function buildMagicLinkEmail(opts: { magicLink: string; displayName: string; isVi: boolean }): string {
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

export const POST = withRateLimit(
  async function POST(request: Request) {
    try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
      }
      const parsed = redeemFreeSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { code, email, fullName, agencyType, tier, locale } = parsed.data;

      // Validate code upfront (public check — userId unknown yet)
      const preCheck = await validatePromoCode(code, { tier });
      if (!preCheck.valid) {
        return NextResponse.json({ error: 'invalid_code', reason: preCheck.reason }, { status: 400 });
      }

      // Only allow free_trial and free_full via this endpoint
      if (preCheck.discountType !== 'free_trial' && preCheck.discountType !== 'free_full') {
        return NextResponse.json(
          { error: 'Code requires payment. Use checkout flow.' },
          { status: 400 },
        );
      }

      const resolved = await findOrResolveUser(request, email);
      let userId = resolved.userId;

      // Anti-abuse: if a logged-in session exists but the email is NOT verified,
      // block redeem. Throwaway-email bot farms would otherwise stack 50 MCU/account.
      // Magic-link users are auto-verified; password sign-ups need to confirm first.
      if (userId && !resolved.sessionEmailVerified) {
        return NextResponse.json(
          { error: 'email_not_verified', hint: 'Please verify your email before redeeming the FREE100 code.' },
          { status: 403 },
        );
      }

      // Auto-create user if not found — promo redeem flow accepts new customers
      // (matches endpoint contract: "Creates user if not found, fires auto-handover")
      if (!userId) {
        try {
          const _db = await getD1();
          if (!_db) {
            throw new Error('D1 unavailable');
          }
          const db = _db;
          const resolvedName = fullName?.trim() || email.split('@')[0];
          userId = await createCustomerUser(db, email, resolvedName);
          logger.info('[RedeemFree] Auto-created customer user', { userId, email });
        } catch (err) {
          logger.error('[RedeemFree] Auto-create user failed', err instanceof Error ? err : undefined);
          return NextResponse.json(
            { error: 'user_create_failed', hint: 'Email may already exist. Try logging in first.' },
            { status: 500 },
          );
        }
      }

      // Full apply with userId (includes per-user limit check)
      const result = await applyPromoCode({
        code,
        userId,
        email,
        fullName,
        agencyType,
        tier: tier ?? preCheck.appliesToTier ?? 'BASIC',
        locale: locale ?? 'vi',
      });

      logger.info('[RedeemFree] Promo redeemed', { code, userId, redemptionId: result.redemptionId });

      // Send magic-link email (non-blocking — failure does not abort response)
      if (result.magicLink) {
        const isVi = (locale ?? 'vi') === 'vi';
        const subject = isVi
          ? 'FREE100 đã kích hoạt — tier MASTER của bạn đã sẵn sàng'
          : 'FREE100 redeemed — your MASTER tier is now active';
        const displayName = fullName?.trim() || email.split('@')[0];
        const html = buildMagicLinkEmail({ magicLink: result.magicLink, displayName, isVi });

        sendEmail({ to: email, subject, html }).then((r) => {
          if (!r.success) {
            logger.warn('[RedeemFree] Magic-link email failed (non-fatal)', { error: r.error, email });
          } else {
            logger.info('[RedeemFree] Magic-link email sent', { messageId: r.messageId, email });
          }
        }).catch(() => { /* non-fatal */ });

        // Send Telegram DM if user has paired their Telegram (non-blocking, non-fatal).
        // Lookup paired chat via paired_by = userId column in telegram_paired_chats.
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
            const tierToSend = (tier ?? preCheck.appliesToTier ?? 'MASTER') as Tier;
            sendHandoverTelegramDm(String(chatId), result.magicLink, tierToSend).catch(() => {
              /* non-fatal — already logged inside */
            });
          }
        } catch (err) {
          logger.warn('[RedeemFree] Telegram DM lookup failed (non-fatal)', err instanceof Error ? err : undefined);
        }
      }

      return NextResponse.json({
        success: true,
        redemptionId: result.redemptionId,
        magicLink: result.magicLink,
        handoverId: result.handoverId,
        trialDaysGranted: result.trialDaysGranted,
        // Signal to client that activation link generation failed (show support CTA)
        handoverError: result.handoverId && !result.magicLink ? 'activation_link_failed' : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Redemption failed';
      logger.error('[RedeemFree] Error', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  },
  { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } },
);
