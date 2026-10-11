/**
 * Executive BI Digest HTML Template Builder
 *
 * Implements:
 * - Responsive 2x2 HTML table metrics card grid (MRR, Throughput, Viral Score, ROI).
 * - Semantic list fallback for accessibility and plain-text fallback.
 * - Integration with Milestone 1 white-label branding (wrapWithAgencyBranding).
 *
 * Layer: forest
 *
 * @module forest/bi/digest/html-template-builder
 */

import { escapeHtml, wrapWithAgencyBranding } from '@/tree/branding/email-styler';
import type {
  ExecutiveBIMetricsSummary,
  BrandingSettings,
  WhiteLabelEmailBranding,
  EmailDigestOptions,
} from './types';

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
