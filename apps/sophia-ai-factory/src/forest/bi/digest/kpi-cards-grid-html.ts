/**
 * Executive BI Digest KPI Cards Grid HTML Builder
 *
 * Layer: forest
 * @module forest/bi/digest/kpi-cards-grid-html
 */

import type { ExecutiveBIMetricsSummary } from './types';

export interface KpiCardsGridParams {
  metrics: ExecutiveBIMetricsSummary;
  isVi: boolean;
  primaryColor: string;
  mrrUsd: string;
  affiliateUsd: string;
  spendUsd: string;
}

export function renderKpiCardsGridHtml({
  metrics,
  isVi,
  primaryColor,
  mrrUsd,
  affiliateUsd,
  spendUsd,
}: KpiCardsGridParams): string {
  return `<!-- 2x2 Responsive KPI Cards Table Grid -->
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
    </table>`;
}
