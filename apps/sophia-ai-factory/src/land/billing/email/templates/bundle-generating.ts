/**
 * Email template: Bundle Generating (video render queued)
 * Sent immediately after a one-time purchase video row is inserted ('queued').
 * Sets customer expectations: ETA ~10 min, links to order status page.
 * Bilingual Vi/En.
 *
 * @module lib/billing/email/templates/bundle-generating
 */

const _APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'
const SUPPORT_EMAIL = 'support@mekongmind.com'

export interface BundleGeneratingContext {
  userEmail: string
  userId: string
  purchaseId: string
  skuLabel: string
  creditsTotal: number
  etaMinutes: number
  statusPageUrl: string
  locale: 'vi' | 'en'
}

export interface BundleGeneratingEmail {
  subject: string
  text: string
  html: string
}

// ── Subject ────────────────────────────────────────────────────────────────

function buildSubject(lang: 'vi' | 'en'): string {
  return lang === 'vi'
    ? '[Sophia AI] Đang tạo video chào mừng của bạn — sẽ sẵn sàng trong ~10 phút'
    : '[Sophia AI] Generating your welcome video — ready in ~10 minutes'
}

// ── Plain text ─────────────────────────────────────────────────────────────

function buildText(ctx: BundleGeneratingContext, lang: 'vi' | 'en'): string {
  if (lang === 'vi') {
    return `Xin chào!

Chúng tôi đã nhận được đơn hàng của bạn và đang tạo video AI cá nhân hóa ngay bây giờ.

Gói: ${ctx.skuLabel}
Credits: ${ctx.creditsTotal}
Thời gian dự kiến: ~${ctx.etaMinutes} phút

Theo dõi trạng thái: ${ctx.statusPageUrl}

Video của bạn sẽ xuất hiện tự động trên trang đơn hàng khi hoàn thành.
Bạn cũng sẽ nhận được email thông báo riêng khi video sẵn sàng.

Nếu cần hỗ trợ: ${SUPPORT_EMAIL}
Mã đơn hàng: ${ctx.purchaseId}

Cảm ơn bạn đã tin tưởng Sophia AI!`
  }

  return `Hello!

We received your order and are generating your personalized AI video right now.

Package: ${ctx.skuLabel}
Credits: ${ctx.creditsTotal}
Estimated time: ~${ctx.etaMinutes} minutes

Track status: ${ctx.statusPageUrl}

Your video will appear automatically on the orders page when complete.
You'll also receive a separate email notification when it's ready.

Need help? ${SUPPORT_EMAIL}
Order reference: ${ctx.purchaseId}

Thank you for choosing Sophia AI!`
}

// ── HTML ───────────────────────────────────────────────────────────────────

function buildHtml(ctx: BundleGeneratingContext, lang: 'vi' | 'en'): string {
  const isVi = lang === 'vi'

  const title = isVi
    ? 'Video của bạn đang được tạo...'
    : 'Your video is being generated...'

  const etaLabel = isVi
    ? `Thời gian dự kiến: ~${ctx.etaMinutes} phút`
    : `Estimated time: ~${ctx.etaMinutes} minutes`

  const creditsLabel = isVi
    ? `Credits trong gói: ${ctx.creditsTotal}`
    : `Credits in package: ${ctx.creditsTotal}`

  const trackLabel = isVi ? 'Xem đơn hàng' : 'View Order'

  const bodyText = isVi
    ? `Chúng tôi đã nhận đơn hàng <strong>${ctx.skuLabel}</strong> và đang tạo video AI ngay bây giờ. Video sẽ tự động xuất hiện trên trang đơn hàng khi hoàn thành.`
    : `We received your <strong>${ctx.skuLabel}</strong> order and are generating your AI video right now. It will automatically appear on your orders page when complete.`

  const supportText = isVi
    ? `Cần hỗ trợ? Email: <a href="mailto:${SUPPORT_EMAIL}" style="color:#818cf8">${SUPPORT_EMAIL}</a>`
    : `Need help? Email: <a href="mailto:${SUPPORT_EMAIL}" style="color:#818cf8">${SUPPORT_EMAIL}</a>`

  const refText = isVi
    ? `Mã đơn hàng: ${ctx.purchaseId}`
    : `Order ref: ${ctx.purchaseId}`

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px">
    <div style="background:#0f0f1a;border:1px solid #312e81;border-radius:12px;padding:32px">

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div style="width:12px;height:12px;border-radius:50%;background:#818cf8;animation:pulse 1.5s infinite"></div>
        <h1 style="color:#a5b4fc;font-size:20px;margin:0">${title}</h1>
      </div>

      <p style="color:#d1d5db;line-height:1.6;margin:0 0 24px">${bodyText}</p>

      <div style="background:#1a1a2e;border:1px solid #2d2b55;border-radius:8px;padding:16px;margin-bottom:24px">
        <p style="color:#a5b4fc;margin:0 0 8px;font-size:14px;font-weight:600">&#x23F1; ${etaLabel}</p>
        <p style="color:#9ca3af;margin:0;font-size:13px">${creditsLabel}</p>
      </div>

      <a href="${ctx.statusPageUrl}"
         style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:24px">
        ${trackLabel}
      </a>

      <hr style="border:none;border-top:1px solid #1e1b4b;margin:24px 0">

      <p style="color:#6b7280;font-size:13px;margin:0 0 6px">${supportText}</p>
      <p style="color:#4b5563;font-size:12px;margin:0">${refText}</p>
    </div>
  </div>
</body>
</html>`
}

// ── Builder ────────────────────────────────────────────────────────────────

export function buildBundleGeneratingEmail(
  ctx: BundleGeneratingContext,
): BundleGeneratingEmail {
  const lang: 'vi' | 'en' = ctx.locale === 'vi' ? 'vi' : 'en'
  return {
    subject: buildSubject(lang),
    text: buildText(ctx, lang),
    html: buildHtml(ctx, lang),
  }
}
