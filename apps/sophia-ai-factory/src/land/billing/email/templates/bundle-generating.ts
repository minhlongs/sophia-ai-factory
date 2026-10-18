/**
 * Email template: Bundle Generating (video render queued)
 * Sent immediately after a one-time purchase video row is inserted ('queued').
 * Sets customer expectations: ETA ~10 min, links to order status page.
 * Bilingual Vi/En.
 *
 * @module lib/billing/email/templates/bundle-generating
 */

import { buildBundleGeneratingHtml, SUPPORT_EMAIL } from './bundle-generating-html'

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

// ── Builder ────────────────────────────────────────────────────────────────

export function buildBundleGeneratingEmail(
  ctx: BundleGeneratingContext,
): BundleGeneratingEmail {
  const lang: 'vi' | 'en' = ctx.locale === 'vi' ? 'vi' : 'en'
  return {
    subject: buildSubject(lang),
    text: buildText(ctx, lang),
    html: buildBundleGeneratingHtml(ctx, lang),
  }
}
