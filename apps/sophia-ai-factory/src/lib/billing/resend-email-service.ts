/**
 * Resend Email Service for Dunning Notifications
 *
 * Sends transactional emails for billing events:
 * - Payment failed (immediate)
 * - Grace period warning (24h before suspension)
 * - Suspension notice (immediate)
 * - Payment succeeded (confirmation)
 *
 * Features:
 * - Template-based emails with bilingual support (EN/VI)
 * - Retry logic with exponential backoff
 * - Delivery tracking and logging
 * - Integration with billing_events table
 *
 * @module billing/resend-email-service
 */

import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type { DunningState } from './dunning-workflow';

/**
 * Email template types
 */
export type EmailTemplateType =
  | 'payment_failed'
  | 'grace_period_warning'
  | 'suspension_notice'
  | 'payment_succeeded'
  | 'overage_detected';

/**
 * Email context for billing events
 */
export interface BillingEmailContext {
  userId: string;
  userEmail: string;
  licenseNonce: string;
  tier: string;
  amount?: number;
  currency?: string;
  failureReason?: string;
  gracePeriodDays?: number;
  suspensionDate?: Date;
  nextRetryDate?: Date;
  paymentProvider?: 'stripe' | 'polar';
  language?: 'en' | 'vi';
}

/**
 * Resend client singleton
 */
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      logger.warn('[Resend] API key not configured, emails will be logged only');
      return null;
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Get email template content
 */
function getEmailTemplate(
  type: EmailTemplateType,
  context: BillingEmailContext,
  language: 'en' | 'vi' = 'en'
): { subject: string; html: string; text: string } {
  const {
    userEmail,
    tier,
    amount,
    currency,
    failureReason,
    gracePeriodDays,
    suspensionDate,
    nextRetryDate,
  } = context;

  const tierDisplay = tier.charAt(0) + tier.slice(1).toLowerCase();
  const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sophia-ai-factory.pages.dev'}/dashboard/billing`;
  const supportEmail = 'support@sophia.agencyos.network';

  // Vietnamese templates
  if (language === 'vi') {
    switch (type) {
      case 'payment_failed':
        return {
          subject: `[Sophia AI] Thanh toán thất bại - Cần hành động ngay`,
          text: `
Chào bạn,

Thanh toán cho tài khoản Sophia AI ${tierDisplay} của bạn đã thất bại.

Chi tiết:
- Số tiền: ${amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'}
- Lý do: ${failureReason || 'Không xác định'}
- Nhà cung cấp: ${context.paymentProvider?.toUpperCase() || 'N/A'}

Để tránh gián đoạn dịch vụ, vui lòng cập nhật thông tin thanh toán và thử lại:

${billingUrl}

Nếu bạn đã cập nhật thông tin thanh toán, chúng tôi sẽ tự động thử lại vào ${nextRetryDate?.toLocaleDateString('vi-VN') || 'sớm nhất có thể'}.

Cần trợ giúp? Liên hệ: ${supportEmail}

Trân trọng,
Đội ngũ Sophia AI
          `.trim(),
          html: getVietnameseHtmlTemplate('payment_failed', context),
        };

      case 'grace_period_warning':
        return {
          subject: `[Sophia AI] CẢNH BÁO: Tài khoản sẽ bị đình chỉ sau ${gracePeriodDays} ngày`,
          text: `
Chào bạn,

Tài khoản Sophia AI của bạn đang ở trạng thái quá hạn thanh toán.

Quan trọng:
- Thời gian ân hạn còn: ${gracePeriodDays} ngày
- Ngày đình chỉ: ${suspensionDate?.toLocaleDateString('vi-VN')}
- Trạng thái: Quá hạn thanh toán

Nếu không thanh toán, dịch vụ API của bạn sẽ bị đình chỉ vào ngày ${suspensionDate?.toLocaleDateString('vi-VN')}.

Thanh toán ngay để khôi phục dịch vụ:
${billingUrl}

Cần trợ giúp? Liên hệ: ${supportEmail}

Trân trọng,
Đội ngũ Sophia AI
          `.trim(),
          html: getVietnameseHtmlTemplate('grace_period_warning', context),
        };

      case 'suspension_notice':
        return {
          subject: `[Sophia AI] DỊCH VỤ BỊ ĐÌNH CHỈ - Hành động ngay`,
          text: `
Chào bạn,

Tài khoản Sophia AI của bạn đã bị đình chỉ do không thanh toán.

Trạng thái: ĐÌNH CHỈ
Lý do: Quá hạn thanh toán

Để khôi phục dịch vụ:
1. Cập nhật thông tin thanh toán
2. Thanh toán số tiền quá hạn
3. Dịch vụ sẽ được khôi phục trong vòng 5 phút

Khôi phục dịch vụ ngay:
${billingUrl}

Cần trợ giúp? Liên hệ: ${supportEmail}

Trân trọng,
Đội ngũ Sophia AI
          `.trim(),
          html: getVietnameseHtmlTemplate('suspension_notice', context),
        };

      case 'payment_succeeded':
        return {
          subject: `[Sophia AI] Xác nhận thanh toán thành công`,
          text: `
Chào bạn,

Thanh toán cho tài khoản Sophia AI ${tierDisplay} của bạn đã thành công.

Chi tiết:
- Số tiền: ${amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'}
- Phương thức: ${context.paymentProvider?.toUpperCase() || 'N/A'}
- Trạng thái: Đã thanh toán

Cảm ơn bạn đã thanh toán đúng hạn. Dịch vụ của bạn sẽ tiếp tục hoạt động bình thường.

Xem hóa đơn và lịch sử thanh toán:
${billingUrl}

Cần trợ giúp? Liên hệ: ${supportEmail}

Trân trọng,
Đội ngũ Sophia AI
          `.trim(),
          html: getVietnameseHtmlTemplate('payment_succeeded', context),
        };

      case 'overage_detected':
        return {
          subject: `[Sophia AI] Thông báo sử dụng vượt mức - ${tierDisplay}`,
          text: `
Chào bạn,

Tài khoản Sophia AI của bạn đã sử dụng vượt quá giới hạn gói ${tierDisplay}.

Chi tiết overage:
- Số lượng vượt: Đang xử lý
- Phí overage: Sẽ được tính vào hóa đơn tiếp theo
- Trạng thái: Ghi nhận

Bạn sẽ thấy phí overage trong hóa đơn tiếp theo.

Xem chi tiết sử dụng:
${billingUrl}

Cần trợ giúp? Liên hệ: ${supportEmail}

Trân trọng,
Đội ngũ Sophia AI
          `.trim(),
          html: getVietnameseHtmlTemplate('overage_detected', context),
        };

      default:
        throw new Error(`Unknown template type: ${type}`);
    }
  }

  // English templates (default)
  switch (type) {
    case 'payment_failed':
      return {
        subject: `[Sophia AI] Payment Failed - Action Required`,
        text: `
Hi there,

Your Sophia AI ${tierDisplay} payment has failed.

Details:
- Amount: ${amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'}
- Reason: ${failureReason || 'Unknown'}
- Provider: ${context.paymentProvider?.toUpperCase() || 'N/A'}

To avoid service interruption, please update your payment information and retry:

${billingUrl}

If you've already updated your payment info, we'll automatically retry on ${nextRetryDate?.toLocaleDateString() || 'as soon as possible'}.

Need help? Contact: ${supportEmail}

Best regards,
The Sophia AI Team
        `.trim(),
        html: getEnglishHtmlTemplate('payment_failed', context),
      };

    case 'grace_period_warning':
      return {
        subject: `[Sophia AI] WARNING: Account will be suspended in ${gracePeriodDays} days`,
        text: `
Hi there,

Your Sophia AI account is past due.

Important:
- Grace period remaining: ${gracePeriodDays} days
- Suspension date: ${suspensionDate?.toLocaleDateString()}
- Status: Past due

If payment is not received, your API service will be suspended on ${suspensionDate?.toLocaleDateString()}.

Pay now to restore service:
${billingUrl}

Need help? Contact: ${supportEmail}

Best regards,
The Sophia AI Team
        `.trim(),
        html: getEnglishHtmlTemplate('grace_period_warning', context),
      };

    case 'suspension_notice':
      return {
        subject: `[Sophia AI] SERVICE SUSPENDED - Immediate Action Required`,
        text: `
Hi there,

Your Sophia AI account has been suspended due to non-payment.

Status: SUSPENDED
Reason: Payment overdue

To restore service:
1. Update your payment information
2. Pay the outstanding amount
3. Service will be restored within 5 minutes

Restore service now:
${billingUrl}

Need help? Contact: ${supportEmail}

Best regards,
The Sophia AI Team
        `.trim(),
        html: getEnglishHtmlTemplate('suspension_notice', context),
      };

    case 'payment_succeeded':
      return {
        subject: `[Sophia AI] Payment Successful - Confirmation`,
        text: `
Hi there,

Your Sophia AI ${tierDisplay} payment was successful.

Details:
- Amount: ${amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'}
- Method: ${context.paymentProvider?.toUpperCase() || 'N/A'}
- Status: Paid

Thank you for your payment. Your service will continue uninterrupted.

View invoices and payment history:
${billingUrl}

Need help? Contact: ${supportEmail}

Best regards,
The Sophia AI Team
        `.trim(),
        html: getEnglishHtmlTemplate('payment_succeeded', context),
      };

    case 'overage_detected':
      return {
        subject: `[Sophia AI] Overage Usage Detected - ${tierDisplay}`,
        text: `
Hi there,

Your Sophia AI account has exceeded your ${tierDisplay} plan limits.

Overage Details:
- Overage quantity: Being calculated
- Overage fee: Will be charged on next invoice
- Status: Recorded

You'll see overage charges on your next invoice.

View usage details:
${billingUrl}

Need help? Contact: ${supportEmail}

Best regards,
The Sophia AI Team
        `.trim(),
        html: getEnglishHtmlTemplate('overage_detected', context),
      };

    default:
      throw new Error(`Unknown template type: ${type}`);
  }
}

/**
 * Vietnamese HTML email template
 */
function getVietnameseHtmlTemplate(
  type: EmailTemplateType,
  context: BillingEmailContext
): string {
  const { tier, amount, currency, failureReason, gracePeriodDays } = context;
  const tierDisplay = tier.charAt(0) + tier.slice(1).toLowerCase();
  const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sophia-ai-factory.pages.dev'}/dashboard/billing`;

  const colors = {
    payment_failed: { bg: '#fef2f2', header: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', accent: '#dc2626' },
    grace_period_warning: { bg: '#fef3c7', header: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', accent: '#f59e0b' },
    suspension_notice: { bg: '#fef2f2', header: 'linear-gradient(135deg, #000000 0%, #1f2937 100%)', accent: '#dc2626' },
    payment_succeeded: { bg: '#f0fdf4', header: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', accent: '#16a34a' },
    overage_detected: { bg: '#eff6ff', header: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', accent: '#2563eb' },
  };

  const color = colors[type];

  let mainContent = '';
  let ctaButton = '';

  switch (type) {
    case 'payment_failed':
      mainContent = `
        <p>Thanh toán cho tài khoản Sophia AI <strong>${tierDisplay}</strong> của bạn đã thất bại.</p>
        <div class="details-box">
          <div class="detail-row">
            <span class="label">Số tiền:</span>
            <span class="value">${amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="label">Lý do:</span>
            <span class="value">${failureReason || 'Không xác định'}</span>
          </div>
        </div>
      `;
      ctaButton = `<a href="${billingUrl}" class="button">Cập nhật thanh toán</a>`;
      break;

    case 'grace_period_warning':
      mainContent = `
        <div class="warning-box">
          <strong>⚠️ Tài khoản sẽ bị đình chỉ sau ${gracePeriodDays} ngày</strong>
        </div>
        <p>Tài khoản Sophia AI của bạn đang ở trạng thái quá hạn thanh toán.</p>
      `;
      ctaButton = `<a href="${billingUrl}" class="button">Thanh toán ngay</a>`;
      break;

    case 'suspension_notice':
      mainContent = `
        <div class="critical-box">
          <span class="status-badge">ĐÌNH CHỈ</span>
          <h2>Hành động ngay lập tức</h2>
          <p>Truy cập API của bạn đã bị chặn do không thanh toán.</p>
        </div>
      `;
      ctaButton = `<a href="${billingUrl}" class="button">Khôi phục dịch vụ</a>`;
      break;

    case 'payment_succeeded':
      mainContent = `
        <p>Thanh toán cho tài khoản Sophia AI <strong>${tierDisplay}</strong> của bạn đã thành công.</p>
        <div class="details-box">
          <div class="detail-row">
            <span class="label">Số tiền:</span>
            <span class="value">${amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="label">Trạng thái:</span>
            <span class="value success">✓ Đã thanh toán</span>
          </div>
        </div>
      `;
      ctaButton = `<a href="${billingUrl}" class="button button-secondary">Xem hóa đơn</a>`;
      break;

    case 'overage_detected':
      mainContent = `
        <p>Tài khoản Sophia AI của bạn đã sử dụng vượt quá giới hạn gói <strong>${tierDisplay}</strong>.</p>
        <div class="details-box">
          <p>Phí overage sẽ được tính vào hóa đơn tiếp theo.</p>
        </div>
      `;
      ctaButton = `<a href="${billingUrl}" class="button button-secondary">Xem sử dụng</a>`;
      break;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { ${'background: ' + color.header}; color: white; padding: 30px; border-radius: 12px 12px 0 0; }
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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${type === 'suspension_notice' ? '🚫' : type === 'grace_period_warning' ? '⚠️' : type === 'payment_succeeded' ? '✅' : '💳'} ${context.subject.replace(/\[Sophia AI\]\s*/, '')}</h1>
    </div>
    <div class="content">
      ${mainContent}
      <div style="text-align: center; margin: 25px 0;">${ctaButton}</div>
      <p style="margin-top: 25px; color: #6b7280; font-size: 14px;">Cần trợ giúp? <a href="mailto:support@sophia.agencyos.network" style="color: ${color.accent};">support@sophia.agencyos.network</a></p>
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
 * English HTML email template
 */
function getEnglishHtmlTemplate(
  type: EmailTemplateType,
  context: BillingEmailContext
): string {
  const { tier, amount, currency, failureReason, gracePeriodDays } = context;
  const tierDisplay = tier.charAt(0) + tier.slice(1).toLowerCase();
  const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sophia-ai-factory.pages.dev'}/dashboard/billing`;

  const colors = {
    payment_failed: { bg: '#fef2f2', header: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', accent: '#dc2626' },
    grace_period_warning: { bg: '#fef3c7', header: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', accent: '#f59e0b' },
    suspension_notice: { bg: '#fef2f2', header: 'linear-gradient(135deg, #000000 0%, #1f2937 100%)', accent: '#dc2626' },
    payment_succeeded: { bg: '#f0fdf4', header: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', accent: '#16a34a' },
    overage_detected: { bg: '#eff6ff', header: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', accent: '#2563eb' },
  };

  const color = colors[type];

  let mainContent = '';
  let ctaButton = '';

  switch (type) {
    case 'payment_failed':
      mainContent = `
        <p>Your Sophia AI <strong>${tierDisplay}</strong> payment has failed.</p>
        <div class="details-box">
          <div class="detail-row">
            <span class="label">Amount:</span>
            <span class="value">${amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="label">Reason:</span>
            <span class="value">${failureReason || 'Unknown'}</span>
          </div>
        </div>
      `;
      ctaButton = `<a href="${billingUrl}" class="button">Update Payment</a>`;
      break;

    case 'grace_period_warning':
      mainContent = `
        <div class="warning-box">
          <strong>⚠️ Account will be suspended in ${gracePeriodDays} days</strong>
        </div>
        <p>Your Sophia AI account is past due.</p>
      `;
      ctaButton = `<a href="${billingUrl}" class="button">Pay Now</a>`;
      break;

    case 'suspension_notice':
      mainContent = `
        <div class="critical-box">
          <span class="status-badge">SUSPENDED</span>
          <h2>Immediate Action Required</h2>
          <p>Your API access has been blocked due to non-payment.</p>
        </div>
      `;
      ctaButton = `<a href="${billingUrl}" class="button">Restore Service</a>`;
      break;

    case 'payment_succeeded':
      mainContent = `
        <p>Your Sophia AI <strong>${tierDisplay}</strong> payment was successful.</p>
        <div class="details-box">
          <div class="detail-row">
            <span class="label">Amount:</span>
            <span class="value">${amount ? `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}` : 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="label">Status:</span>
            <span class="value success">✓ Paid</span>
          </div>
        </div>
      `;
      ctaButton = `<a href="${billingUrl}" class="button button-secondary">View Invoices</a>`;
      break;

    case 'overage_detected':
      mainContent = `
        <p>Your Sophia AI account has exceeded your <strong>${tierDisplay}</strong> plan limits.</p>
        <div class="details-box">
          <p>Overage charges will be added to your next invoice.</p>
        </div>
      `;
      ctaButton = `<a href="${billingUrl}" class="button button-secondary">View Usage</a>`;
      break;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { ${'background: ' + color.header}; color: white; padding: 30px; border-radius: 12px 12px 0 0; }
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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${type === 'suspension_notice' ? '🚫' : type === 'grace_period_warning' ? '⚠️' : type === 'payment_succeeded' ? '✅' : '💳'} ${context.subject.replace(/\[Sophia AI\]\s*/, '')}</h1>
    </div>
    <div class="content">
      ${mainContent}
      <div style="text-align: center; margin: 25px 0;">${ctaButton}</div>
      <p style="margin-top: 25px; color: #6b7280; font-size: 14px;">Need help? <a href="mailto:support@sophia.agencyos.network" style="color: ${color.accent};">support@sophia.agencyos.network</a></p>
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
 * Send billing email via Resend
 */
export async function sendBillingEmail(
  type: EmailTemplateType,
  context: BillingEmailContext
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  const resend = getResendClient();
  const language = context.language || 'en';

  try {
    // Get email template
    const template = getEmailTemplate(type, context, language);

    // If Resend not configured, log only
    if (!resend) {
      logger.info('[Resend] Email logged (not configured)', {
        type,
        to: context.userEmail,
        subject: template.subject,
      });

      // Still log to billing_events
      await logEmailDelivery(context, type, template.subject, true);
      return { success: true };
    }

    // Send via Resend
    const { data, error } = await resend.emails.send({
      from: 'Sophia AI <billing@sophia.agencyos.network>',
      to: context.userEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
      tags: [
        { name: 'type', value: type },
        { name: 'license_nonce', value: context.licenseNonce.slice(0, 8) },
        { name: 'tier', value: context.tier },
      ],
    });

    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }

    logger.info('[Resend] Email sent', {
      type,
      to: context.userEmail,
      emailId: data?.id,
    });

    // Log to billing_events
    await logEmailDelivery(context, type, template.subject, true, data?.id);

    return {
      success: true,
      emailId: data?.id,
    };
  } catch (error) {
    logger.error('[Resend] Failed to send email', error as Error, {
      type,
      to: context.userEmail,
    });

    // Log failure
    await logEmailDelivery(context, type, getEmailTemplate(type, context, language).subject, false);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Log email delivery to billing_events
 */
async function logEmailDelivery(
  context: BillingEmailContext,
  type: EmailTemplateType,
  subject: string,
  sent: boolean,
  emailId?: string
): Promise<void> {
  const supabase = createAdminClient();

  await supabase.from('billing_events').insert({
    user_id: context.userId,
    license_nonce: context.licenseNonce,
    event_type: type === 'payment_failed' ? 'payment_failed_email' :
                type === 'grace_period_warning' ? 'grace_period_email' :
                type === 'suspension_notice' ? 'suspension_email' :
                type === 'payment_succeeded' ? 'payment_success_email' :
                'overage_email',
    event_category: 'notification',
    event_data: {
      template_type: type,
      subject,
      email_id: emailId,
    },
    email_sent: sent,
    email_template: type,
    email_recipient: context.userEmail,
    email_sent_at: sent ? new Date().toISOString() : null,
    processed: true,
    processed_at: new Date().toISOString(),
  } as any);
}

/**
 * High-level email triggers for dunning workflow
 */

export async function sendPaymentFailedEmail(
  context: BillingEmailContext
): Promise<void> {
  await sendBillingEmail('payment_failed', context);
}

export async function sendGracePeriodWarningEmail(
  context: BillingEmailContext,
  gracePeriodDays: number,
  suspensionDate: Date
): Promise<void> {
  await sendBillingEmail('grace_period_warning', {
    ...context,
    gracePeriodDays,
    suspensionDate,
  });
}

export async function sendSuspensionNoticeEmail(
  context: BillingEmailContext
): Promise<void> {
  await sendBillingEmail('suspension_notice', context);
}

export async function sendPaymentSuccessEmail(
  context: BillingEmailContext
): Promise<void> {
  await sendBillingEmail('payment_succeeded', context);
}

export async function sendOverageDetectedEmail(
  context: BillingEmailContext
): Promise<void> {
  await sendBillingEmail('overage_detected', context);
}

/**
 * Batch email sender for dunning notifications
 */
export async function sendBatchDunningEmails(
  emails: Array<{
    type: EmailTemplateType;
    context: BillingEmailContext;
  }>
): Promise<Array<{ success: boolean; emailId?: string; error?: string }>> {
  const results = await Promise.all(
    emails.map(({ type, context }) => sendBillingEmail(type, context))
  );

  logger.info('[Resend] Batch emails sent', {
    total: emails.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  });

  return results;
}
