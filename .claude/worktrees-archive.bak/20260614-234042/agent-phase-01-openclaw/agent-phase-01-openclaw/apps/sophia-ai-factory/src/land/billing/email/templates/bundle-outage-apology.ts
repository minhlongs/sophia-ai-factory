/**
 * Email template: Bundle Outage Apology (circuit breaker opened)
 * Bilingual Vi/En. Notifies affected customers of service disruption
 * and confirms automatic 7-day TTL extension for their bundle.
 *
 * @module lib/billing/email/templates/bundle-outage-apology
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'
const DASHBOARD_URL = `${APP_URL}/dashboard/orders`
const SUPPORT_EMAIL = 'support@mekongmind.com'

export interface BundleOutageApologyContext {
  userEmail?: string
  userId: string
  purchaseId: string
  locale?: string
  /** Unix timestamp when circuit opened (seconds) */
  openedAt: number
}

function buildSubject(lang: 'vi' | 'en'): string {
  return lang === 'vi'
    ? '[Sophia AI] Xin lỗi — chúng tôi đang khắc phục sự cố'
    : '[Sophia AI] Sorry — we\'re working on a service issue'
}

function buildText(ctx: BundleOutageApologyContext, lang: 'vi' | 'en'): string {
  if (lang === 'vi') {
    return `Xin chào,

Chúng tôi thành thật xin lỗi vì dịch vụ tạo video AI đang gặp sự cố kỹ thuật tạm thời.

Đội ngũ kỹ thuật đang tích cực xử lý và dự kiến khắc phục trong vòng 24 giờ.

Để đền bù cho sự bất tiện này, chúng tôi đã tự động gia hạn bundle của bạn thêm 7 ngày.
Video của bạn sẽ được xử lý ngay khi hệ thống hoạt động trở lại.

Theo dõi trạng thái: ${DASHBOARD_URL}

Cần hỗ trợ? Liên hệ: ${SUPPORT_EMAIL}
Mã đơn hàng (để hỗ trợ nhanh hơn): ${ctx.purchaseId}

Cảm ơn bạn đã kiên nhẫn chờ đợi.
Sophia AI Team`
  }

  return `Hello,

We sincerely apologize — our AI video generation service is experiencing a temporary technical issue.

Our engineering team is actively working on it and expects to resolve within 24 hours.

To make up for this inconvenience, we've automatically extended your bundle by 7 days.
Your video will be processed as soon as the service is restored.

Track your order status: ${DASHBOARD_URL}

Need help? Contact: ${SUPPORT_EMAIL}
Order reference (for faster support): ${ctx.purchaseId}

Thank you for your patience.
Sophia AI Team`
}

function buildHtml(ctx: BundleOutageApologyContext, lang: 'vi' | 'en'): string {
  const isVi = lang === 'vi'
  const title = isVi ? 'Xin lỗi — Dịch vụ tạm gián đoạn' : 'Service Temporarily Disrupted'
  const extendNotice = isVi
    ? 'Bundle của bạn đã được tự động gia hạn thêm <strong>7 ngày</strong>.'
    : 'Your bundle has been automatically extended by <strong>7 days</strong>.'
  const etaText = isVi
    ? 'Dự kiến khắc phục trong vòng <strong>24 giờ</strong>.'
    : 'Expected resolution within <strong>24 hours</strong>.'
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
    <div style="background:#0c1a2e;border:1px solid #1e3a5f;border-radius:12px;padding:32px">
      <h1 style="color:#93c5fd;font-size:22px;margin:0 0 16px">&#x1F6E0; ${title}</h1>

      <div style="background:#1c1c1c;border:1px solid #2d2d2d;border-radius:8px;padding:16px;margin-bottom:16px">
        <p style="color:#86efac;margin:0 0 8px;font-size:14px;font-weight:600">&#x23F1; ${etaText}</p>
        <p style="color:#fbbf24;margin:0;font-size:14px;font-weight:600">&#x2795; ${extendNotice}</p>
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

export interface BundleOutageApologyEmail {
  subject: string
  text: string
  html: string
}

export function buildBundleOutageApologyEmail(
  ctx: BundleOutageApologyContext,
): BundleOutageApologyEmail {
  const locale = ctx.locale ?? 'vi'
  const lang: 'vi' | 'en' = locale.startsWith('vi') ? 'vi' : 'en'

  return {
    subject: buildSubject(lang),
    text: buildText(ctx, lang),
    html: buildHtml(ctx, lang),
  }
}
