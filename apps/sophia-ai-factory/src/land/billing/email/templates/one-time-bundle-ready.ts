/**
 * Email template: One-Time Bundle Ready
 * Sent when a one-time purchase video is completed and ready to watch.
 * Bilingual Vi/En. Includes credit balance + cross-sell CTA (upgrade to subscription).
 *
 * @module lib/billing/email/templates/one-time-bundle-ready
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'
const DASHBOARD_URL = `${APP_URL}/dashboard/videos`
const PRICING_URL = `${APP_URL}/pricing`
const SUPPORT_EMAIL = 'support@sophia.agencyos.network'

export interface OneTimeBundleReadyContext {
  userEmail: string
  userId: string
  purchaseId: string
  creditsRemaining: number
  videoUrl?: string | null
  locale?: string
}

function buildSubject(lang: 'vi' | 'en'): string {
  return lang === 'vi'
    ? '[Sophia AI] Video của bạn đã sẵn sàng!'
    : '[Sophia AI] Your bundle video is ready!'
}

function buildText(ctx: OneTimeBundleReadyContext, lang: 'vi' | 'en'): string {
  if (lang === 'vi') {
    return `Xin chào!

Video AI từ Gói Khởi Đầu của bạn đã hoàn thành.
${ctx.videoUrl ? `Xem video: ${ctx.videoUrl}` : ''}

Số credits còn lại: ${ctx.creditsRemaining}
Dashboard: ${DASHBOARD_URL}

--- Nâng cấp lên gói hàng tháng ---
Muốn tạo video không giới hạn mỗi tháng? Xem các gói tại: ${PRICING_URL}

Hỗ trợ: ${SUPPORT_EMAIL}`
  }

  return `Hello!

Your AI video from the Starter Bundle is ready.
${ctx.videoUrl ? `Watch video: ${ctx.videoUrl}` : ''}

Credits remaining: ${ctx.creditsRemaining}
Dashboard: ${DASHBOARD_URL}

--- Upgrade to a monthly plan ---
Want unlimited videos every month? See plans at: ${PRICING_URL}

Support: ${SUPPORT_EMAIL}`
}

function buildHtml(ctx: OneTimeBundleReadyContext, lang: 'vi' | 'en'): string {
  const isVi = lang === 'vi'
  const title = isVi ? 'Video của bạn đã sẵn sàng!' : 'Your bundle video is ready!'
  const creditsLabel = isVi
    ? `Credits còn lại: <strong>${ctx.creditsRemaining}</strong>`
    : `Credits remaining: <strong>${ctx.creditsRemaining}</strong>`
  const watchLabel = isVi ? 'Xem video' : 'Watch video'
  const dashboardLabel = isVi ? 'Mở Dashboard' : 'Open Dashboard'
  const upgradeHeading = isVi ? 'Muốn tạo video không giới hạn?' : 'Want unlimited videos?'
  const upgradeText = isVi
    ? 'Nâng cấp lên gói hàng tháng để tận hưởng video không giới hạn, tính năng nâng cao và hỗ trợ ưu tiên.'
    : 'Upgrade to a monthly plan for unlimited videos, advanced features, and priority support.'
  const upgradeLabel = isVi ? 'Xem gói hàng tháng' : 'See monthly plans'

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px">
    <div style="background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:32px">
      <h1 style="color:#10b981;font-size:24px;margin:0 0 8px">&#x1F3A5; ${title}</h1>
      <p style="color:#aaa;margin:0 0 24px;font-size:14px">${creditsLabel}</p>

      ${ctx.videoUrl ? `
      <a href="${ctx.videoUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:12px">${watchLabel}</a>
      <br>
      ` : ''}

      <a href="${DASHBOARD_URL}" style="display:inline-block;background:#333;color:#e5e5e5;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:24px">${dashboardLabel}</a>

      <hr style="border:none;border-top:1px solid #333;margin:24px 0">

      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px">
        <h3 style="color:#818cf8;margin:0 0 8px;font-size:16px">${upgradeHeading}</h3>
        <p style="color:#94a3b8;font-size:14px;margin:0 0 16px">${upgradeText}</p>
        <a href="${PRICING_URL}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">${upgradeLabel}</a>
      </div>

      <p style="color:#555;font-size:12px;margin:24px 0 0">
        ${isVi ? 'Hỗ trợ' : 'Support'}: <a href="mailto:${SUPPORT_EMAIL}" style="color:#10b981">${SUPPORT_EMAIL}</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

export interface OneTimeBundleReadyEmail {
  subject: string
  text: string
  html: string
}

export function buildOneTimeBundleReadyEmail(
  ctx: OneTimeBundleReadyContext,
): OneTimeBundleReadyEmail {
  const locale = ctx.locale ?? 'vi'
  const lang: 'vi' | 'en' = locale.startsWith('vi') ? 'vi' : 'en'

  return {
    subject: buildSubject(lang),
    text: buildText(ctx, lang),
    html: buildHtml(ctx, lang),
  }
}
