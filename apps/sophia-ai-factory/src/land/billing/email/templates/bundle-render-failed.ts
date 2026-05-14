/**
 * Email template: Bundle Render Failed (permanent failure after 5 retries)
 * Bilingual Vi/En. Includes apology, +1 credit grant notice, support link.
 *
 * @module lib/billing/email/templates/bundle-render-failed
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'
const DASHBOARD_URL = `${APP_URL}/dashboard/orders`
const SUPPORT_EMAIL = 'support@mekongmind.com'

export interface BundleRenderFailedContext {
  userEmail?: string
  userId: string
  purchaseId: string
  locale?: string
}

function buildSubject(lang: 'vi' | 'en'): string {
  return lang === 'vi'
    ? '[Sophia AI] Xin lỗi — Video của bạn chưa thể tạo được (đã +1 credit bù)'
    : '[Sophia AI] Apologies — Your video could not be rendered (+1 credit added)'
}

function buildText(ctx: BundleRenderFailedContext, lang: 'vi' | 'en'): string {
  if (lang === 'vi') {
    return `Xin chào,

Chúng tôi rất tiếc thông báo rằng video AI của bạn không thể được tạo sau nhiều lần thử.

Để bù đắp sự bất tiện này, chúng tôi đã tự động thêm +1 credit vào tài khoản của bạn.

Kiểm tra trạng thái đơn hàng: ${DASHBOARD_URL}

Nếu bạn cần hỗ trợ, vui lòng liên hệ: ${SUPPORT_EMAIL}
Mã đơn hàng (để hỗ trợ nhanh hơn): ${ctx.purchaseId}

Chúng tôi sẽ tiếp tục cải thiện dịch vụ để điều này không xảy ra nữa.
Cảm ơn bạn đã tin tưởng Sophia AI.`
  }

  return `Hello,

We're sorry to inform you that your AI video could not be rendered after multiple attempts.

To compensate for this inconvenience, we've automatically added +1 credit to your account.

Check your order status: ${DASHBOARD_URL}

If you need assistance, please contact: ${SUPPORT_EMAIL}
Order reference (for faster support): ${ctx.purchaseId}

We're committed to improving our service to prevent this from happening again.
Thank you for your trust in Sophia AI.`
}

function buildHtml(ctx: BundleRenderFailedContext, lang: 'vi' | 'en'): string {
  const isVi = lang === 'vi'
  const title = isVi ? 'Xin lỗi — Video chưa tạo được' : 'Apologies — Video could not be rendered'
  const creditNotice = isVi
    ? '+1 credit đã được thêm vào tài khoản của bạn tự động.'
    : '+1 credit has been automatically added to your account.'
  const orderLabel = isVi ? 'Xem đơn hàng' : 'View Order'
  const supportText = isVi
    ? `Cần hỗ trợ? Email: <a href="mailto:${SUPPORT_EMAIL}" style="color:#10b981">${SUPPORT_EMAIL}</a>`
    : `Need help? Email: <a href="mailto:${SUPPORT_EMAIL}" style="color:#10b981">${SUPPORT_EMAIL}</a>`
  const refText = isVi ? `Mã đơn hàng: ${ctx.purchaseId}` : `Order ref: ${ctx.purchaseId}`

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px">
    <div style="background:#1a0000;border:1px solid #7f1d1d;border-radius:12px;padding:32px">
      <h1 style="color:#fca5a5;font-size:22px;margin:0 0 16px">&#x26A0; ${title}</h1>

      <div style="background:#1c1c1c;border:1px solid #2d2d2d;border-radius:8px;padding:16px;margin-bottom:24px">
        <p style="color:#86efac;margin:0;font-size:14px;font-weight:600">&#x2705; ${creditNotice}</p>
      </div>

      <a href="${DASHBOARD_URL}"
         style="display:inline-block;background:#374151;color:#e5e5e5;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:24px">
        ${orderLabel}
      </a>

      <hr style="border:none;border-top:1px solid #333;margin:24px 0">

      <p style="color:#9ca3af;font-size:13px;margin:0 0 8px">${supportText}</p>
      <p style="color:#6b7280;font-size:12px;margin:0">${refText}</p>
    </div>
  </div>
</body>
</html>`
}

export interface BundleRenderFailedEmail {
  subject: string
  text: string
  html: string
}

export function buildBundleRenderFailedEmail(
  ctx: BundleRenderFailedContext,
): BundleRenderFailedEmail {
  const locale = ctx.locale ?? 'vi'
  const lang: 'vi' | 'en' = locale.startsWith('vi') ? 'vi' : 'en'

  return {
    subject: buildSubject(lang),
    text: buildText(ctx, lang),
    html: buildHtml(ctx, lang),
  }
}
