/**
 * Email Template Builder — bilingual (EN/VI) HTML and text templates for billing events
 * @module billing/email/email-template-builder
 */

import type { EmailTemplateType, BillingEmailContext } from './types'
import { TEMPLATE_COLORS, getTypeEmoji, wrapHtmlTemplate } from './email-template-html-layout'
import { buildEnglishHtmlContent, buildVietnameseHtmlContent } from './email-template-html-content'

const BILLING_URL = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sophia-ai-factory.pages.dev'}/dashboard/billing`

export function buildHtmlTemplate(type: EmailTemplateType, context: BillingEmailContext, language: 'en' | 'vi'): string {
  const color = TEMPLATE_COLORS[type]
  const emoji = getTypeEmoji(type)
  const { mainContent, ctaButton } = language === 'vi'
    ? buildVietnameseHtmlContent(type, context, BILLING_URL)
    : buildEnglishHtmlContent(type, context, BILLING_URL)
  const titleText = getEmailSubject(type, context, language).replace(/\[Sophia AI\]\s*/, '')
  return wrapHtmlTemplate(mainContent, ctaButton, color, emoji, titleText)
}

export function getEmailSubject(type: EmailTemplateType, context: BillingEmailContext, language: 'en' | 'vi'): string {
  const tierDisplay = context.tier.charAt(0) + context.tier.slice(1).toLowerCase()
  if (language === 'vi') {
    switch (type) {
      case 'payment_failed':       return '[Sophia AI] Thanh toán thất bại - Cần hành động ngay'
      case 'grace_period_warning': return `[Sophia AI] CẢNH BÁO: Tài khoản sẽ bị đình chỉ sau ${context.gracePeriodDays} ngày`
      case 'suspension_notice':    return '[Sophia AI] DỊCH VỤ BỊ ĐÌNH CHỈ - Hành động ngay'
      case 'payment_succeeded':    return '[Sophia AI] Xác nhận thanh toán thành công'
      case 'overage_detected':     return `[Sophia AI] Thông báo sử dụng vượt mức - ${tierDisplay}`
    }
  }
  switch (type) {
    case 'payment_failed':       return '[Sophia AI] Payment Failed - Action Required'
    case 'grace_period_warning': return `[Sophia AI] WARNING: Account will be suspended in ${context.gracePeriodDays} days`
    case 'suspension_notice':    return '[Sophia AI] SERVICE SUSPENDED - Immediate Action Required'
    case 'payment_succeeded':    return '[Sophia AI] Payment Successful - Confirmation'
    case 'overage_detected':     return `[Sophia AI] Overage Usage Detected - ${tierDisplay}`
  }
}

export function buildTextTemplate(type: EmailTemplateType, context: BillingEmailContext, language: 'en' | 'vi'): string {
  const { amount, currency, failureReason, gracePeriodDays, suspensionDate, nextRetryDate } = context
  const tierDisplay = context.tier.charAt(0) + context.tier.slice(1).toLowerCase()
  const supportEmail = 'support@mekongmind.com'
  const amountStr = amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'
  const providerStr = context.paymentProvider?.toUpperCase() || 'N/A'

  if (language === 'vi') {
    switch (type) {
      case 'payment_failed':       return `Thanh toán cho tài khoản Sophia AI ${tierDisplay} đã thất bại.\n\nSố tiền: ${amountStr}\nLý do: ${failureReason || 'Không xác định'}\n\n${BILLING_URL}\n\n${supportEmail}`
      case 'grace_period_warning': return `Thời gian ân hạn còn: ${gracePeriodDays} ngày\nNgày đình chỉ: ${suspensionDate?.toLocaleDateString('vi-VN')}\n\n${BILLING_URL}`
      case 'suspension_notice':    return `Tài khoản đã bị đình chỉ. Khôi phục: ${BILLING_URL}`
      case 'payment_succeeded':    return `Thanh toán thành công. Số tiền: ${amountStr}\nPhương thức: ${providerStr}\n\n${BILLING_URL}`
      case 'overage_detected':     return `Sử dụng vượt mức gói ${tierDisplay}. Phí sẽ được tính vào hóa đơn tiếp theo.\n\n${BILLING_URL}`
    }
  }
  switch (type) {
    case 'payment_failed':       return `Your Sophia AI ${tierDisplay} payment has failed.\n\nAmount: ${amountStr}\nReason: ${failureReason || 'Unknown'}\nRetry date: ${nextRetryDate?.toLocaleDateString() || 'as soon as possible'}\n\n${BILLING_URL}\n\n${supportEmail}`
    case 'grace_period_warning': return `Grace period remaining: ${gracePeriodDays} days\nSuspension date: ${suspensionDate?.toLocaleDateString()}\n\n${BILLING_URL}`
    case 'suspension_notice':    return `Account suspended due to non-payment. Restore service: ${BILLING_URL}`
    case 'payment_succeeded':    return `Payment successful. Amount: ${amountStr}\nMethod: ${providerStr}\n\n${BILLING_URL}`
    case 'overage_detected':     return `Your ${tierDisplay} plan limit exceeded. Overage charges on next invoice.\n\n${BILLING_URL}`
  }
}
