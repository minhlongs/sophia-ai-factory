/**
 * Per-type HTML content blocks for billing email templates (EN + VI)
 * @module billing/email/email-template-html-content
 */

import type { EmailTemplateType, BillingEmailContext } from './types'

type ContentBlock = { mainContent: string; ctaButton: string }

export function buildEnglishHtmlContent(type: EmailTemplateType, context: BillingEmailContext, billingUrl: string): ContentBlock {
  const { amount, currency, failureReason, gracePeriodDays, gracePeriodDaysLeft, suspensionDate, nextRetryDate } = context
  const tierDisplay = context.tier.charAt(0) + context.tier.slice(1).toLowerCase()
  const amountStr = amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'
  const retryUrl = `${billingUrl}?retry=true`
  const daysLeft = gracePeriodDaysLeft ?? 2
  const suspensionDateStr = suspensionDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) ?? ''
  const retryDateStr = nextRetryDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) ?? ''

  switch (type) {
    case 'payment_failed':
      return {
        mainContent: `<p>Your Sophia AI <strong>${tierDisplay}</strong> payment has failed.</p>
          <div class="details-box">
            <div class="detail-row"><span class="label">Amount:</span><span class="value">${amountStr}</span></div>
            <div class="detail-row"><span class="label">Reason:</span><span class="value">${failureReason || 'Unknown'}</span></div>
          </div>`,
        ctaButton: `<a href="${billingUrl}" class="button">Update Payment</a>`,
      }
    case 'grace_period_warning':
      return {
        mainContent: `<div class="warning-box"><strong>⚠️ Account will be suspended in ${gracePeriodDays} days</strong></div><p>Your Sophia AI account is past due.</p>`,
        ctaButton: `<a href="${billingUrl}" class="button">Pay Now</a>`,
      }
    case 'suspension_notice':
      return {
        mainContent: `<div class="critical-box"><span class="status-badge">SUSPENDED</span><h2>Immediate Action Required</h2><p>Your API access has been blocked due to non-payment.</p></div>`,
        ctaButton: `<a href="${billingUrl}" class="button">Restore Service</a>`,
      }
    case 'payment_succeeded':
      return {
        mainContent: `<p>Your Sophia AI <strong>${tierDisplay}</strong> payment was successful.</p>
          <div class="details-box">
            <div class="detail-row"><span class="label">Amount:</span><span class="value">${amountStr}</span></div>
            <div class="detail-row"><span class="label">Status:</span><span class="value success">✓ Paid</span></div>
          </div>`,
        ctaButton: `<a href="${billingUrl}" class="button button-secondary">View Invoices</a>`,
      }
    case 'overage_detected':
      return {
        mainContent: `<p>Your Sophia AI account has exceeded your <strong>${tierDisplay}</strong> plan limits.</p><div class="details-box"><p>Overage charges will be added to your next invoice.</p></div>`,
        ctaButton: `<a href="${billingUrl}" class="button button-secondary">View Usage</a>`,
      }
    case 'dunning_day1':
      return {
        mainContent: `<p>We weren't able to process your <strong>Sophia AI ${tierDisplay}</strong> subscription payment. Your account is still active while we sort this out.</p>
          <div class="details-box">
            <div class="detail-row"><span class="label">Amount:</span><span class="value">${amountStr}</span></div>
            ${failureReason ? `<div class="detail-row"><span class="label">Reason:</span><span class="value">${failureReason}</span></div>` : ''}
            ${retryDateStr ? `<div class="detail-row"><span class="label">Auto-retry:</span><span class="value">${retryDateStr}</span></div>` : ''}
          </div>`,
        ctaButton: `<a href="${retryUrl}" class="button">Update Payment Method</a>`,
      }
    case 'dunning_day3':
      return {
        mainContent: `<div class="warning-box"><strong>⚠️ Only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left before your ${tierDisplay} account is suspended</strong></div>
          <p>Your account has an outstanding payment. Update now to keep your campaigns running.</p>
          <div class="details-box">
            <div class="detail-row"><span class="label">Amount due:</span><span class="value">${amountStr}</span></div>
            ${suspensionDateStr ? `<div class="detail-row"><span class="label">Suspension date:</span><span class="value">${suspensionDateStr}</span></div>` : ''}
          </div>`,
        ctaButton: `<a href="${retryUrl}" class="button">Pay Now — Keep My Account</a>`,
      }
    case 'dunning_day5':
      return {
        mainContent: `<div class="critical-box"><span class="status-badge">FINAL WARNING</span><h2>Account Suspension Today</h2>
          <p>Your <strong>${tierDisplay}</strong> account will be suspended due to non-payment of <strong>${amountStr}</strong>.</p>
          ${suspensionDateStr ? `<p class="suspension-date">Suspension date: ${suspensionDateStr}</p>` : ''}
          </div>`,
        ctaButton: `<a href="${retryUrl}" class="button">Pay Now — Prevent Suspension</a>`,
      }
  }
}

export function buildVietnameseHtmlContent(type: EmailTemplateType, context: BillingEmailContext, billingUrl: string): ContentBlock {
  const { amount, currency, failureReason, gracePeriodDays, gracePeriodDaysLeft, suspensionDate, nextRetryDate } = context
  const tierDisplay = context.tier.charAt(0) + context.tier.slice(1).toLowerCase()
  const amountStr = amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'
  const retryUrl = `${billingUrl}?retry=true`
  const daysLeft = gracePeriodDaysLeft ?? 2
  const suspensionDateStr = suspensionDate?.toLocaleDateString('vi-VN') ?? ''
  const retryDateStr = nextRetryDate?.toLocaleDateString('vi-VN') ?? ''

  switch (type) {
    case 'payment_failed':
      return {
        mainContent: `<p>Thanh toán cho tài khoản Sophia AI <strong>${tierDisplay}</strong> của bạn đã thất bại.</p>
          <div class="details-box">
            <div class="detail-row"><span class="label">Số tiền:</span><span class="value">${amountStr}</span></div>
            <div class="detail-row"><span class="label">Lý do:</span><span class="value">${failureReason || 'Không xác định'}</span></div>
          </div>`,
        ctaButton: `<a href="${billingUrl}" class="button">Cập nhật thanh toán</a>`,
      }
    case 'grace_period_warning':
      return {
        mainContent: `<div class="warning-box"><strong>⚠️ Tài khoản sẽ bị đình chỉ sau ${gracePeriodDays} ngày</strong></div><p>Tài khoản Sophia AI của bạn đang ở trạng thái quá hạn thanh toán.</p>`,
        ctaButton: `<a href="${billingUrl}" class="button">Thanh toán ngay</a>`,
      }
    case 'suspension_notice':
      return {
        mainContent: `<div class="critical-box"><span class="status-badge">ĐÌNH CHỈ</span><h2>Hành động ngay lập tức</h2><p>Truy cập API của bạn đã bị chặn do không thanh toán.</p></div>`,
        ctaButton: `<a href="${billingUrl}" class="button">Khôi phục dịch vụ</a>`,
      }
    case 'payment_succeeded':
      return {
        mainContent: `<p>Thanh toán cho tài khoản Sophia AI <strong>${tierDisplay}</strong> của bạn đã thành công.</p>
          <div class="details-box">
            <div class="detail-row"><span class="label">Số tiền:</span><span class="value">${amountStr}</span></div>
            <div class="detail-row"><span class="label">Trạng thái:</span><span class="value success">✓ Đã thanh toán</span></div>
          </div>`,
        ctaButton: `<a href="${billingUrl}" class="button button-secondary">Xem hóa đơn</a>`,
      }
    case 'overage_detected':
      return {
        mainContent: `<p>Tài khoản Sophia AI của bạn đã sử dụng vượt quá giới hạn gói <strong>${tierDisplay}</strong>.</p><div class="details-box"><p>Phí overage sẽ được tính vào hóa đơn tiếp theo.</p></div>`,
        ctaButton: `<a href="${billingUrl}" class="button button-secondary">Xem sử dụng</a>`,
      }
    case 'dunning_day1':
      return {
        mainContent: `<p>Chúng tôi không thể xử lý thanh toán gói <strong>Sophia AI ${tierDisplay}</strong> của bạn. Tài khoản của bạn vẫn đang hoạt động trong khi chúng tôi giải quyết.</p>
          <div class="details-box">
            <div class="detail-row"><span class="label">Số tiền:</span><span class="value">${amountStr}</span></div>
            ${failureReason ? `<div class="detail-row"><span class="label">Lý do:</span><span class="value">${failureReason}</span></div>` : ''}
            ${retryDateStr ? `<div class="detail-row"><span class="label">Thử lại tự động:</span><span class="value">${retryDateStr}</span></div>` : ''}
          </div>`,
        ctaButton: `<a href="${retryUrl}" class="button">Cập Nhật Phương Thức Thanh Toán</a>`,
      }
    case 'dunning_day3':
      return {
        mainContent: `<div class="warning-box"><strong>⚠️ Chỉ còn ${daysLeft} ngày trước khi tài khoản ${tierDisplay} bị đình chỉ</strong></div>
          <p>Tài khoản có khoản thanh toán chưa hoàn thành. Cập nhật ngay để chiến dịch tiếp tục hoạt động.</p>
          <div class="details-box">
            <div class="detail-row"><span class="label">Số tiền cần thanh toán:</span><span class="value">${amountStr}</span></div>
            ${suspensionDateStr ? `<div class="detail-row"><span class="label">Ngày đình chỉ:</span><span class="value">${suspensionDateStr}</span></div>` : ''}
          </div>`,
        ctaButton: `<a href="${retryUrl}" class="button">Thanh Toán Ngay — Giữ Tài Khoản</a>`,
      }
    case 'dunning_day5':
      return {
        mainContent: `<div class="critical-box"><span class="status-badge">CẢNH BÁO CUỐI</span><h2>Tài Khoản Sẽ Bị Đình Chỉ Hôm Nay</h2>
          <p>Tài khoản <strong>${tierDisplay}</strong> của bạn sẽ bị đình chỉ do chưa thanh toán <strong>${amountStr}</strong>.</p>
          ${suspensionDateStr ? `<p class="suspension-date">Ngày đình chỉ: ${suspensionDateStr}</p>` : ''}
          </div>`,
        ctaButton: `<a href="${retryUrl}" class="button">Thanh Toán Ngay — Ngăn Chặn Đình Chỉ</a>`,
      }
  }
}
