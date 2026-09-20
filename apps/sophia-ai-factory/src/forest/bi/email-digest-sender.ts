/**
 * Email Executive BI Digest Dispatcher & HTML Formatter
 *
 * Implements:
 * - Responsive 2x2 HTML table metrics card grid (MRR, Throughput, Viral Score, ROI).
 * - Semantic list fallback for accessibility and plain-text fallback.
 * - Integration with Milestone 1 white-label branding (wrapWithAgencyBranding).
 * - Resend API email dispatch via src/tree/email/sender.ts.
 *
 * Layer: forest (side-effect dispatcher)
 * Allowed imports: @/seed/*, @/tree/*, @/forest/*
 *
 * @module forest/bi/email-digest-sender
 */

import { sendEmail } from '@/tree/email/sender';
import { escapeHtml, wrapWithAgencyBranding } from '@/tree/branding/email-styler';
import type { ExecutiveBIMetricsSummary } from '@/seed/types/executive-bi';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import type { WhiteLabelEmailBranding } from '@/tree/branding/email-styler';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

export interface EmailDigestOptions {
  to?: string | string[];
  branding?: Partial<BrandingSettings> | WhiteLabelEmailBranding | null;
  periodLabel?: string;
  cadence?: 'weekly' | 'monthly';
  portalUrl?: string;
  additionalNotesHtml?: string;
  locale?: 'vi' | 'en';
}

export interface EmailDigestResult {
  success: boolean;
  messageId?: string;
  recipientCount: number;
  provider: 'resend' | 'dry-run';
  error?: string;
}

/**
 * Renders the inner HTML content of the Executive Digest with 2x2 KPI card grid
 * and semantic list fallback.
 */
export function renderExecutiveDigestInnerHtml(
  metrics: ExecutiveBIMetricsSummary,
  options: EmailDigestOptions = {},
): string {
  const isVi = options.locale === 'vi';
  const primaryColor = options.branding?.primaryColor || '#0f172a';
  const portalUrl = options.portalUrl ?? 'https://sophia.agencyos.network/dashboard/analytics';

  const mrrUsd = (metrics.mrrCents / 100).toFixed(2);
  const affiliateUsd = (metrics.affiliateRevenueCents / 100).toFixed(2);
  const spendUsd = (metrics.marketingSpendCents / 100).toFixed(2);

  const title = options.cadence === 'weekly'
    ? (isVi ? 'Bản tin BI Điều hành Hàng tuần' : 'Executive Weekly Performance Report')
    : (isVi ? 'Báo cáo Hiệu suất Điều hành Hàng tháng' : 'Executive Monthly Performance Report');

  const periodSubtitle = options.periodLabel
    ? `<div style="font-size: 13px; color: #64748b; margin-top: 4px; margin-bottom: 20px;">
        ${isVi ? 'Kỳ báo cáo:' : 'Reporting Period:'} <strong>${escapeHtml(options.periodLabel)}</strong>
       </div>`
    : '';

  const ctaLabel = isVi ? 'Mở Bảng Điều khiển BI →' : 'View Executive BI Dashboard →';

  return `
    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0;">${escapeHtml(title)}</h2>
    ${periodSubtitle}

    <!-- 2x2 Responsive KPI Cards Table Grid -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
      <tr>
        <!-- Card 1: MRR -->
        <td width="48%" style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; vertical-align: top;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">
            ${isVi ? 'Doanh thu Định kỳ (MRR)' : 'Monthly Recurring Revenue'}
          </div>
          <div style="font-size: 24px; font-weight: 700; color: ${primaryColor}; margin: 6px 0 2px 0;">
            $${mrrUsd}
          </div>
          <div style="font-size: 12px; color: #94a3b8;">${isVi ? 'Đỉnh MRR trong kỳ' : 'Peak MRR this period'}</div>
        </td>
        <td width="4%">&nbsp;</td>
        <!-- Card 2: Throughput -->
        <td width="48%" style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; vertical-align: top;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">
            ${isVi ? 'Sản lượng Video' : 'Video Throughput'}
          </div>
          <div style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 6px 0 2px 0;">
            ${metrics.throughputCount} ${isVi ? 'video' : 'videos'}
          </div>
          <div style="font-size: 12px; color: #94a3b8;">${isVi ? 'Kết xuất tự động đa kênh' : 'Autonomous multi-track renders'}</div>
        </td>
      </tr>
      <tr><td height="12" colspan="3">&nbsp;</td></tr>
      <tr>
        <!-- Card 3: Viral Score -->
        <td width="48%" style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; vertical-align: top;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">
            ${isVi ? 'Điểm Lan truyền' : 'Average Viral Score'}
          </div>
          <div style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 6px 0 2px 0;">
            ${metrics.viralScore}/100
          </div>
          <div style="font-size: 12px; color: #94a3b8;">${isVi ? 'Chỉ số tương tác trung bình' : 'Average engagement index'}</div>
        </td>
        <td width="4%">&nbsp;</td>
        <!-- Card 4: Affiliate ROI -->
        <td width="48%" style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; vertical-align: top;">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">
            ${isVi ? 'Hiệu suất Tiếp thị Liên kết' : 'Affiliate ROI'}
          </div>
          <div style="font-size: 24px; font-weight: 700; color: #10b981; margin: 6px 0 2px 0;">
            ${metrics.roiRatio}x
          </div>
          <div style="font-size: 12px; color: #94a3b8;">$${affiliateUsd} rev / $${spendUsd} spend</div>
        </td>
      </tr>
    </table>

    <!-- Semantic List Fallback -->
    <ul style="margin: 16px 0; padding-left: 20px; line-height: 1.8; color: #334155;">
      <li>Monthly Recurring Revenue: $${mrrUsd}</li>
      <li>Videos Produced: ${metrics.throughputCount}</li>
      <li>Average Viral Engagement: ${metrics.viralScore}/100</li>
      <li>Affiliate ROI: ${metrics.roiRatio}x</li>
    </ul>

    ${options.additionalNotesHtml ? `<div style="margin: 16px 0;">${options.additionalNotesHtml}</div>` : ''}

    <!-- Call to Action -->
    <div style="margin: 28px 0 12px 0; text-align: center;">
      <a href="${escapeHtml(portalUrl)}" class="brand-btn" style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 24px; border-radius: 6px; font-weight: 600; text-decoration: none; display: inline-block;">
        ${escapeHtml(ctaLabel)}
      </a>
    </div>
  `.trim();
}

/**
 * Formats full HTML Email Digest wrapped with Milestone 1 agency branding.
 * Required signature: formatEmailDigest(metrics, branding)
 */
export function formatEmailDigest(
  metrics: ExecutiveBIMetricsSummary,
  branding?: Partial<BrandingSettings> | WhiteLabelEmailBranding | null,
  options?: Omit<EmailDigestOptions, 'branding'>,
): string {
  const innerHtml = renderExecutiveDigestInnerHtml(metrics, { ...options, branding });
  const sanitizedBranding: Partial<BrandingSettings> = {
    agencyName: branding?.agencyName ?? undefined,
    logoUrl: branding?.logoUrl ?? undefined,
    primaryColor: branding?.primaryColor ?? undefined,
    accentColor: branding?.accentColor ?? undefined,
    customDomain: branding?.customDomain ?? undefined,
    emailFromName: branding?.emailFromName ?? undefined,
    emailFooter: branding?.emailFooter ?? undefined,
  };
  return wrapWithAgencyBranding(innerHtml, sanitizedBranding);
}

/**
 * Sends an Executive BI Email Digest to a recipient email.
 * Required signature: sendEmailExecutiveDigest(resendApiKey, recipientEmail, metrics, branding)
 */
export async function sendEmailExecutiveDigest(
  resendApiKey: string | undefined,
  recipientEmail: string,
  metrics: ExecutiveBIMetricsSummary,
  branding?: Partial<BrandingSettings> | WhiteLabelEmailBranding | null,
  options?: Omit<EmailDigestOptions, 'to' | 'branding'>,
): Promise<EmailDigestResult> {
  const recipient = (recipientEmail ?? '').trim();
  if (!recipient) {
    return {
      success: false,
      recipientCount: 0,
      provider: 'dry-run',
      error: 'RECIPIENT_REQUIRED: recipientEmail must not be empty',
    };
  }

  const wrappedHtml = formatEmailDigest(metrics, branding, options);
  const agencyName = branding?.agencyName ?? 'Sophia AI Factory';
  const cadenceLabel = options?.cadence === 'weekly' ? 'Weekly' : 'Monthly';
  const subject = `${agencyName} — ${cadenceLabel} Executive BI Digest`;

  const effectiveApiKey = resendApiKey || process.env.RESEND_API_KEY;

  if (!effectiveApiKey) {
    logger.info('[email-digest-sender] RESEND_API_KEY not provided — operating in dry-run mode', {
      recipient,
      agencyName,
    });
    return {
      success: false,
      recipientCount: 1,
      provider: 'dry-run',
      error: 'RESEND_API_KEY not configured',
    };
  }

  try {
    const res = await sendEmail({
      to: recipient,
      subject,
      html: wrappedHtml,
      branding: branding as WhiteLabelEmailBranding | undefined,
    });

    return {
      success: res.success,
      recipientCount: res.success ? 1 : 0,
      messageId: res.messageId,
      provider: 'resend',
      error: res.error,
    };
  } catch (err) {
    const errMsg = getErrorMessage(err);
    logger.error('[email-digest-sender] Failed sending email digest', {
      recipient,
      error: errMsg,
    });
    return {
      success: false,
      recipientCount: 0,
      provider: 'resend',
      error: errMsg,
    };
  }
}

/**
 * Multi-recipient wrapper alias matching sendEmailDigest(metrics, options).
 */
export async function sendEmailDigest(
  metrics: ExecutiveBIMetricsSummary,
  options: EmailDigestOptions,
): Promise<EmailDigestResult> {
  const recipients = Array.isArray(options.to) ? options.to : options.to ? [options.to] : [];
  if (recipients.length === 0) {
    return { success: false, recipientCount: 0, provider: 'dry-run', error: 'No recipients provided' };
  }

  let successCount = 0;
  let lastMessageId: string | undefined;
  let lastError: string | undefined;

  for (const r of recipients) {
    const res = await sendEmailExecutiveDigest(
      process.env.RESEND_API_KEY,
      r,
      metrics,
      options.branding,
      options,
    );
    if (res.success) {
      successCount++;
      lastMessageId = res.messageId;
    } else {
      lastError = res.error;
    }
  }

  return {
    success: successCount > 0,
    recipientCount: successCount,
    messageId: lastMessageId,
    provider: process.env.RESEND_API_KEY ? 'resend' : 'dry-run',
    error: successCount === 0 ? lastError : undefined,
  };
}
