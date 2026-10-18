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
import { renderKpiCardsGridHtml } from './kpi-cards-grid-html';
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
  const kpiCardsHtml = renderKpiCardsGridHtml({
    metrics,
    isVi,
    primaryColor,
    mrrUsd,
    affiliateUsd,
    spendUsd,
  });

  return `
    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0;">${escapeHtml(title)}</h2>
    ${periodSubtitle}

    ${kpiCardsHtml}

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
