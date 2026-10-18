/**
 * High-DPI Printable HTML Report Engine
 * Layer: tree/partners
 *
 * @module tree/partners/export/html-export-engine
 */

import type {
  PartnerAnalyticsSummary,
  CohortRow,
} from '@/tree/partners/partner-analytics';
import type { PartnerExportBranding } from './types';
import { escapeHtml } from './escaping-utils';
import { generateSvgSparkline } from './sparkline-generator';
import { normalizeAnalyticsArgs } from './args-normalizer';
import {
  getMrrDataPoints,
  renderPrintableHtmlDocument,
} from './html-export-template';

/**
 * Generates a high-DPI printable HTML report with SVG sparklines and partner branding
 * ready for browser/client PDF export with zero vendor leakage.
 */
export function formatPartnerPrintableHtml(
  analyticsDataOrCohorts: PartnerAnalyticsSummary | CohortRow[],
  partnerInfoOrSummary?: PartnerExportBranding | Record<string, unknown>,
  brandingIfThreeArgs?: PartnerExportBranding,
): string {
  const { analyticsData, partnerInfo } = normalizeAnalyticsArgs(
    analyticsDataOrCohorts,
    partnerInfoOrSummary,
    brandingIfThreeArgs,
  );
  const brandName =
    partnerInfo?.brandName ||
    partnerInfo?.agencyName ||
    analyticsData.partnerName ||
    'Enterprise Partner Agency';
  const logoUrl = partnerInfo?.logoUrl || null;
  const primaryColor = partnerInfo?.primaryColor || '#06b6d4';
  const accentColor = partnerInfo?.accentColor || '#3b82f6';
  const reportPeriod = partnerInfo?.reportPeriod || analyticsData.period || 'Executive Review';
  const generatedDate = new Date(analyticsData.generatedAt || Date.now()).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    },
  );
  const supportUrl = partnerInfo?.supportUrl || 'https://agency.domain/support';
  const confidentialNote =
    partnerInfo?.confidentialityNote ||
    `Confidential business analytics report generated exclusively for clients and management of ${escapeHtml(brandName)}.`;

  const mrrDataPoints = getMrrDataPoints(analyticsData);
  const mrrSparklineSvg = generateSvgSparkline(mrrDataPoints, {
    width: 140,
    height: 36,
    strokeColor: primaryColor,
  });

  const mcuDataPoints =
    analyticsData.topSubClients.length > 0
      ? analyticsData.topSubClients.map((sc) => sc.mcuVelocityDaily)
      : [15, 22, 38, 45, 62, 58];
  const mcuSparklineSvg = generateSvgSparkline(mcuDataPoints, {
    width: 140,
    height: 36,
    strokeColor: accentColor,
  });

  return renderPrintableHtmlDocument({
    brandName,
    logoUrl,
    primaryColor,
    accentColor,
    reportPeriod,
    generatedDate,
    supportUrl,
    confidentialNote,
    analyticsData,
    mrrSparklineSvg,
    mcuSparklineSvg,
  });
}
