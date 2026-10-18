/**
 * HTML renderer for Bundle Generating email template (Bilingual Vi/En)
 *
 * @module land/billing/email/templates/bundle-generating-html
 */

import type { BundleGeneratingContext } from './bundle-generating'

export const SUPPORT_EMAIL = 'support@mekongmind.com'

export function buildBundleGeneratingHtml(
  ctx: BundleGeneratingContext,
  lang: 'vi' | 'en',
): string {
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
