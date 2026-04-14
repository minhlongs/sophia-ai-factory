/**
 * Email Template Builder
 *
 * Generates bilingual (EN/VI) HTML and text email templates
 * for all billing event types.
 *
 * @module billing/email/email-template-builder
 */

import type { EmailTemplateType, BillingEmailContext } from './types';

/**
 * Template color schemes per email type
 */
const TEMPLATE_COLORS: Record<EmailTemplateType, { bg: string; header: string; accent: string }> = {
  payment_failed: { bg: '#fef2f2', header: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', accent: '#dc2626' },
  grace_period_warning: { bg: '#fef3c7', header: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', accent: '#f59e0b' },
  suspension_notice: { bg: '#fef2f2', header: 'linear-gradient(135deg, #000000 0%, #1f2937 100%)', accent: '#dc2626' },
  payment_succeeded: { bg: '#f0fdf4', header: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', accent: '#16a34a' },
  overage_detected: { bg: '#eff6ff', header: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', accent: '#2563eb' },
};

/**
 * Shared CSS styles for HTML email templates
 */
function getEmailCss(color: { bg: string; header: string; accent: string }): string {
  return `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${color.header}; color: white; padding: 30px; border-radius: 12px 12px 0 0; }
    .header h1 { margin: 0 0 10px 0; font-size: 24px; }
    .content { background: ${color.bg}; padding: 30px; border-radius: 0 0 12px 12px; }
    .details-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-row:last-child { border-bottom: none; }
    .detail-row .label { color: #6b7280; }
    .detail-row .value { font-weight: 600; }
    .detail-row .value.success { color: #16a34a; }
    .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .critical-box { background: #fee2e2; border: 2px solid #dc2626; padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center; }
    .status-badge { display: inline-block; background: #dc2626; color: white; padding: 6px 20px; border-radius: 20px; font-weight: bold; font-size: 14px; }
    .button { display: inline-block; background: ${color.accent}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 15px 5px 10px 0; font-weight: 600; }
    .button-secondary { background: #6b7280; }
    .footer { text-align: center; padding: 30px 20px; color: #6b7280; font-size: 14px; }
    @media (max-width: 600px) { .container { padding: 10px; } .header, .content { padding: 20px; } }
  `;
}

/**
 * Build HTML email wrapper with consistent header/footer
 */
function wrapHtmlTemplate(
  type: EmailTemplateType,
  mainContent: string,
  ctaButton: string,
  color: { bg: string; header: string; accent: string },
  titleEmoji: string,
  titleText: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${getEmailCss(color)}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${titleEmoji} ${titleText}</h1>
    </div>
    <div class="content">
      ${mainContent}
      <div style="text-align: center; margin: 25px 0;">${ctaButton}</div>
      <p style="margin-top: 25px; color: #6b7280; font-size: 14px;">
        Need help? <a href="mailto:support@sophia.agencyos.network" style="color: ${color.accent};">support@sophia.agencyos.network</a>
      </p>
    </div>
    <div class="footer">
      <p>© 2026 Sophia AI Factory. All rights reserved.</p>
      <p>Sophia AI - AI Video Factory</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Get type-specific emoji for email header
 */
function getTypeEmoji(type: EmailTemplateType): string {
  switch (type) {
    case 'suspension_notice': return '🚫';
    case 'grace_period_warning': return '⚠️';
    case 'payment_succeeded': return '✅';
    default: return '💳';
  }
}

/**
 * Build HTML content block for each email type (English)
 */
function buildEnglishHtmlContent(
  type: EmailTemplateType,
  context: BillingEmailContext,
  billingUrl: string
): { mainContent: string; ctaButton: string } {
  const { amount, currency, failureReason, gracePeriodDays } = context;
  const tierDisplay = context.tier.charAt(0) + context.tier.slice(1).toLowerCase();

  switch (type) {
    case 'payment_failed':
      return {
        mainContent: `
          <p>Your Sophia AI <strong>${tierDisplay}</strong> payment has failed.</p>
          <div class="details-box">
            <div class="detail-row"><span class="label">Amount:</span><span class="value">${amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'}</span></div>
            <div class="detail-row"><span class="label">Reason:</span><span class="value">${failureReason || 'Unknown'}</span></div>
          </div>`,
        ctaButton: `<a href="${billingUrl}" class="button">Update Payment</a>`,
      };
    case 'grace_period_warning':
      return {
        mainContent: `
          <div class="warning-box"><strong>⚠️ Account will be suspended in ${gracePeriodDays} days</strong></div>
          <p>Your Sophia AI account is past due.</p>`,
        ctaButton: `<a href="${billingUrl}" class="button">Pay Now</a>`,
      };
    case 'suspension_notice':
      return {
        mainContent: `
          <div class="critical-box">
            <span class="status-badge">SUSPENDED</span>
            <h2>Immediate Action Required</h2>
            <p>Your API access has been blocked due to non-payment.</p>
          </div>`,
        ctaButton: `<a href="${billingUrl}" class="button">Restore Service</a>`,
      };
    case 'payment_succeeded':
      return {
        mainContent: `
          <p>Your Sophia AI <strong>${tierDisplay}</strong> payment was successful.</p>
          <div class="details-box">
            <div class="detail-row"><span class="label">Amount:</span><span class="value">${amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'}</span></div>
            <div class="detail-row"><span class="label">Status:</span><span class="value success">✓ Paid</span></div>
          </div>`,
        ctaButton: `<a href="${billingUrl}" class="button button-secondary">View Invoices</a>`,
      };
    case 'overage_detected':
      return {
        mainContent: `
          <p>Your Sophia AI account has exceeded your <strong>${tierDisplay}</strong> plan limits.</p>
          <div class="details-box"><p>Overage charges will be added to your next invoice.</p></div>`,
        ctaButton: `<a href="${billingUrl}" class="button button-secondary">View Usage</a>`,
      };
  }
}

/**
 * Build HTML content block for each email type (Vietnamese)
 */
function buildVietnameseHtmlContent(
  type: EmailTemplateType,
  context: BillingEmailContext,
  billingUrl: string
): { mainContent: string; ctaButton: string } {
  const { amount, currency, failureReason, gracePeriodDays } = context;
  const tierDisplay = context.tier.charAt(0) + context.tier.slice(1).toLowerCase();

  switch (type) {
    case 'payment_failed':
      return {
        mainContent: `
          <p>Thanh toán cho tài khoản Sophia AI <strong>${tierDisplay}</strong> của bạn đã thất bại.</p>
          <div class="details-box">
            <div class="detail-row"><span class="label">Số tiền:</span><span class="value">${amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'}</span></div>
            <div class="detail-row"><span class="label">Lý do:</span><span class="value">${failureReason || 'Không xác định'}</span></div>
          </div>`,
        ctaButton: `<a href="${billingUrl}" class="button">Cập nhật thanh toán</a>`,
      };
    case 'grace_period_warning':
      return {
        mainContent: `
          <div class="warning-box"><strong>⚠️ Tài khoản sẽ bị đình chỉ sau ${gracePeriodDays} ngày</strong></div>
          <p>Tài khoản Sophia AI của bạn đang ở trạng thái quá hạn thanh toán.</p>`,
        ctaButton: `<a href="${billingUrl}" class="button">Thanh toán ngay</a>`,
      };
    case 'suspension_notice':
      return {
        mainContent: `
          <div class="critical-box">
            <span class="status-badge">ĐÌNH CHỈ</span>
            <h2>Hành động ngay lập tức</h2>
            <p>Truy cập API của bạn đã bị chặn do không thanh toán.</p>
          </div>`,
        ctaButton: `<a href="${billingUrl}" class="button">Khôi phục dịch vụ</a>`,
      };
    case 'payment_succeeded':
      return {
        mainContent: `
          <p>Thanh toán cho tài khoản Sophia AI <strong>${tierDisplay}</strong> của bạn đã thành công.</p>
          <div class="details-box">
            <div class="detail-row"><span class="label">Số tiền:</span><span class="value">${amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'}</span></div>
            <div class="detail-row"><span class="label">Trạng thái:</span><span class="value success">✓ Đã thanh toán</span></div>
          </div>`,
        ctaButton: `<a href="${billingUrl}" class="button button-secondary">Xem hóa đơn</a>`,
      };
    case 'overage_detected':
      return {
        mainContent: `
          <p>Tài khoản Sophia AI của bạn đã sử dụng vượt quá giới hạn gói <strong>${tierDisplay}</strong>.</p>
          <div class="details-box"><p>Phí overage sẽ được tính vào hóa đơn tiếp theo.</p></div>`,
        ctaButton: `<a href="${billingUrl}" class="button button-secondary">Xem sử dụng</a>`,
      };
  }
}

/**
 * Generate HTML email template
 */
export function buildHtmlTemplate(
  type: EmailTemplateType,
  context: BillingEmailContext,
  language: 'en' | 'vi'
): string {
  const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sophia-ai-factory.pages.dev'}/dashboard/billing`;
  const color = TEMPLATE_COLORS[type];
  const emoji = getTypeEmoji(type);

  const { mainContent, ctaButton } = language === 'vi'
    ? buildVietnameseHtmlContent(type, context, billingUrl)
    : buildEnglishHtmlContent(type, context, billingUrl);

  // Title: strip [Sophia AI] prefix for display in header
  const titleText = getEmailSubject(type, context, language).replace(/\[Sophia AI\]\s*/, '');

  return wrapHtmlTemplate(type, mainContent, ctaButton, color, emoji, titleText);
}

/**
 * Get plain-text email subject line
 */
export function getEmailSubject(
  type: EmailTemplateType,
  context: BillingEmailContext,
  language: 'en' | 'vi'
): string {
  const tierDisplay = context.tier.charAt(0) + context.tier.slice(1).toLowerCase();

  if (language === 'vi') {
    switch (type) {
      case 'payment_failed': return '[Sophia AI] Thanh toán thất bại - Cần hành động ngay';
      case 'grace_period_warning': return `[Sophia AI] CẢNH BÁO: Tài khoản sẽ bị đình chỉ sau ${context.gracePeriodDays} ngày`;
      case 'suspension_notice': return '[Sophia AI] DỊCH VỤ BỊ ĐÌNH CHỈ - Hành động ngay';
      case 'payment_succeeded': return '[Sophia AI] Xác nhận thanh toán thành công';
      case 'overage_detected': return `[Sophia AI] Thông báo sử dụng vượt mức - ${tierDisplay}`;
    }
  }

  switch (type) {
    case 'payment_failed': return '[Sophia AI] Payment Failed - Action Required';
    case 'grace_period_warning': return `[Sophia AI] WARNING: Account will be suspended in ${context.gracePeriodDays} days`;
    case 'suspension_notice': return '[Sophia AI] SERVICE SUSPENDED - Immediate Action Required';
    case 'payment_succeeded': return '[Sophia AI] Payment Successful - Confirmation';
    case 'overage_detected': return `[Sophia AI] Overage Usage Detected - ${tierDisplay}`;
  }
}

/**
 * Get plain-text email body
 */
export function buildTextTemplate(
  type: EmailTemplateType,
  context: BillingEmailContext,
  language: 'en' | 'vi'
): string {
  const { amount, currency, failureReason, gracePeriodDays, suspensionDate, nextRetryDate } = context;
  const tierDisplay = context.tier.charAt(0) + context.tier.slice(1).toLowerCase();
  const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sophia-ai-factory.pages.dev'}/dashboard/billing`;
  const supportEmail = 'support@sophia.agencyos.network';
  const amountStr = amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A';
  const providerStr = context.paymentProvider?.toUpperCase() || 'N/A';

  if (language === 'vi') {
    switch (type) {
      case 'payment_failed':
        return `Thanh toán cho tài khoản Sophia AI ${tierDisplay} đã thất bại.\n\nSố tiền: ${amountStr}\nLý do: ${failureReason || 'Không xác định'}\n\n${billingUrl}\n\n${supportEmail}`;
      case 'grace_period_warning':
        return `Thời gian ân hạn còn: ${gracePeriodDays} ngày\nNgày đình chỉ: ${suspensionDate?.toLocaleDateString('vi-VN')}\n\n${billingUrl}`;
      case 'suspension_notice':
        return `Tài khoản đã bị đình chỉ. Khôi phục: ${billingUrl}`;
      case 'payment_succeeded':
        return `Thanh toán thành công. Số tiền: ${amountStr}\nPhương thức: ${providerStr}\n\n${billingUrl}`;
      case 'overage_detected':
        return `Sử dụng vượt mức gói ${tierDisplay}. Phí sẽ được tính vào hóa đơn tiếp theo.\n\n${billingUrl}`;
    }
  }

  switch (type) {
    case 'payment_failed':
      return `Your Sophia AI ${tierDisplay} payment has failed.\n\nAmount: ${amountStr}\nReason: ${failureReason || 'Unknown'}\nRetry date: ${nextRetryDate?.toLocaleDateString() || 'as soon as possible'}\n\n${billingUrl}\n\n${supportEmail}`;
    case 'grace_period_warning':
      return `Grace period remaining: ${gracePeriodDays} days\nSuspension date: ${suspensionDate?.toLocaleDateString()}\n\n${billingUrl}`;
    case 'suspension_notice':
      return `Account suspended due to non-payment. Restore service: ${billingUrl}`;
    case 'payment_succeeded':
      return `Payment successful. Amount: ${amountStr}\nMethod: ${providerStr}\n\n${billingUrl}`;
    case 'overage_detected':
      return `Your ${tierDisplay} plan limit exceeded. Overage charges on next invoice.\n\n${billingUrl}`;
  }
}
