/**
 * Refund email templates — bilingual Vi/En.
 * Four templates: received, approved, rejected, completed.
 *
 * @module lib/billing/email/templates/refund-emails
 */

const SUPPORT_EMAIL = 'support@mekongmind.com'
const _APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'

export interface RefundEmailCtx {
  userEmail: string
  purchaseId: string
  amountUsd?: number
  reason?: string
  adminNotes?: string
  txHash?: string
  locale?: string
}

function lang(ctx: RefundEmailCtx): 'vi' | 'en' {
  return (ctx.locale ?? 'vi').startsWith('vi') ? 'vi' : 'en'
}

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:28px">
<h2 style="color:#10b981;margin:0 0 16px">${title}</h2>
${body}
<p style="color:#555;font-size:12px;margin:24px 0 0">Support: <a href="mailto:${SUPPORT_EMAIL}" style="color:#10b981">${SUPPORT_EMAIL}</a></p>
</div></body></html>`
}

// ── Template: request received ─────────────────────────────────────────────

export function buildRefundReceivedEmail(ctx: RefundEmailCtx): { subject: string; text: string; html: string } {
  const l = lang(ctx)
  const subject = l === 'vi'
    ? '[Sophia AI] Yêu cầu hoàn tiền đã nhận'
    : '[Sophia AI] Refund request received'
  const text = l === 'vi'
    ? `Xin chào,\n\nChúng tôi đã nhận yêu cầu hoàn tiền cho đơn hàng ${ctx.purchaseId}.\nĐội ngũ hỗ trợ sẽ xem xét trong vòng 24 giờ.\n\nHỗ trợ: ${SUPPORT_EMAIL}`
    : `Hello,\n\nWe received your refund request for order ${ctx.purchaseId}.\nOur team will review within 24 hours.\n\nSupport: ${SUPPORT_EMAIL}`
  const html = wrap(
    l === 'vi' ? 'Yêu cầu hoàn tiền đã nhận' : 'Refund Request Received',
    `<p>${l === 'vi' ? `Chúng tôi đã nhận yêu cầu hoàn tiền cho đơn <strong>${ctx.purchaseId}</strong>.` : `We received your refund request for order <strong>${ctx.purchaseId}</strong>.`}</p>
     <p style="color:#94a3b8;font-size:14px">${l === 'vi' ? 'Đội ngũ sẽ liên hệ trong vòng 24 giờ làm việc.' : 'Our team will follow up within 24 business hours.'}</p>`,
  )
  return { subject, text, html }
}

// ── Template: approved ─────────────────────────────────────────────────────

export function buildRefundApprovedEmail(ctx: RefundEmailCtx): { subject: string; text: string; html: string } {
  const l = lang(ctx)
  const subject = l === 'vi'
    ? '[Sophia AI] Hoàn tiền được chấp thuận'
    : '[Sophia AI] Refund approved'
  const text = l === 'vi'
    ? `Yêu cầu hoàn tiền của bạn đã được chấp thuận.\nChúng tôi sẽ xử lý USDT về ví của bạn trong vòng 24 giờ.\nMã giao dịch sẽ được gửi khi hoàn tất.`
    : `Your refund has been approved.\nWe will process the USDT transfer to your wallet within 24 hours.\nYou'll receive the transaction hash when complete.`
  const html = wrap(
    l === 'vi' ? 'Hoàn tiền được chấp thuận ✓' : 'Refund Approved ✓',
    `<p>${l === 'vi' ? 'Yêu cầu hoàn tiền đã được chấp thuận.' : 'Your refund request has been approved.'}</p>
     <p style="color:#94a3b8;font-size:14px">${l === 'vi' ? 'USDT sẽ được chuyển về ví của bạn trong vòng 24 giờ. Mã giao dịch sẽ được gửi riêng.' : 'USDT will be transferred to your wallet within 24 hours. The transaction hash will follow in a separate email.'}</p>`,
  )
  return { subject, text, html }
}

// ── Template: rejected ─────────────────────────────────────────────────────

export function buildRefundRejectedEmail(ctx: RefundEmailCtx): { subject: string; text: string; html: string } {
  const l = lang(ctx)
  const subject = l === 'vi'
    ? '[Sophia AI] Yêu cầu hoàn tiền bị từ chối'
    : '[Sophia AI] Refund request rejected'
  const notes = ctx.adminNotes ? `\n\nLý do: ${ctx.adminNotes}` : ''
  const text = l === 'vi'
    ? `Rất tiếc, yêu cầu hoàn tiền của bạn không được chấp thuận.${notes}\n\nNếu có thắc mắc, liên hệ: ${SUPPORT_EMAIL}`
    : `We're sorry, your refund request was not approved.${notes}\n\nFor questions, contact: ${SUPPORT_EMAIL}`
  const html = wrap(
    l === 'vi' ? 'Yêu cầu hoàn tiền bị từ chối' : 'Refund Request Rejected',
    `<p>${l === 'vi' ? 'Rất tiếc, yêu cầu hoàn tiền của bạn không được chấp thuận.' : "We're sorry, your refund request was not approved."}</p>
     ${ctx.adminNotes ? `<p style="color:#94a3b8;font-size:14px">${l === 'vi' ? 'Lý do' : 'Reason'}: ${ctx.adminNotes}</p>` : ''}`,
  )
  return { subject, text, html }
}

// ── Template: refund completed ─────────────────────────────────────────────

export function buildRefundCompletedEmail(ctx: RefundEmailCtx): { subject: string; text: string; html: string } {
  const l = lang(ctx)
  const subject = l === 'vi'
    ? '[Sophia AI] Hoàn tiền hoàn tất'
    : '[Sophia AI] Refund completed'
  const txLine = ctx.txHash ? (l === 'vi' ? `\nMã giao dịch: ${ctx.txHash}` : `\nTransaction hash: ${ctx.txHash}`) : ''
  const text = l === 'vi'
    ? `Hoàn tiền của bạn đã được xử lý thành công.${txLine}\n\nCảm ơn bạn đã sử dụng Sophia AI.`
    : `Your refund has been processed successfully.${txLine}\n\nThank you for using Sophia AI.`
  const html = wrap(
    l === 'vi' ? 'Hoàn tiền hoàn tất ✓' : 'Refund Completed ✓',
    `<p>${l === 'vi' ? 'Hoàn tiền của bạn đã được xử lý thành công.' : 'Your refund has been processed successfully.'}</p>
     ${ctx.txHash ? `<p style="font-family:monospace;font-size:13px;color:#10b981">${l === 'vi' ? 'Mã giao dịch' : 'TX Hash'}: <strong>${ctx.txHash}</strong></p>` : ''}
     <p style="color:#94a3b8;font-size:14px">${l === 'vi' ? 'Bạn có thể kiểm tra giao dịch trên Tronscan.' : 'You can verify the transaction on Tronscan.'}</p>`,
  )
  return { subject, text, html }
}
