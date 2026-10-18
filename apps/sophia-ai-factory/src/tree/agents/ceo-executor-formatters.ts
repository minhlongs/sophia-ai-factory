/**
 * CEO Agent — Formatting helpers for campaign status and revenue summaries.
 *
 * Layer: tree/agents (imports from local types only)
 */

import type { CampaignSummary, RevenueInsights } from './ceo-intent-types';

/**
 * Format a currency value for bilingual display.
 */
export function formatCeoCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Map campaign status to bilingual label.
 */
export function formatCeoCampaignStatus(status: string): string {
  switch (status) {
    case 'pending':
      return 'Chờ xử lý (Pending)';
    case 'running':
      return 'Đang chạy (Running)';
    case 'completed':
      return 'Hoàn thành (Completed)';
    case 'failed':
      return 'Thất bại (Failed)';
    default:
      return status;
  }
}

/**
 * Build a human-readable campaign list summary.
 */
export function formatCampaignListSummary(campaigns: CampaignSummary[]): string {
  if (campaigns.length === 0) {
    return 'No campaigns found. Create one with "create campaign [topic]"!';
  }
  return (
    `Found ${campaigns.length} campaigns:\n` +
    campaigns
      .map((c) => `- ${c.title} (${formatCeoCampaignStatus(c.status as string)})`)
      .join('\n')
  );
}

/**
 * Build a human-readable revenue summary string.
 */
export function formatRevenueInsightsSummary(revenue: RevenueInsights): string {
  return (
    `Revenue insights (${revenue.periodLabel}):\n` +
    `Total: ${formatCeoCurrency(revenue.totalRevenue)}\n` +
    `Recurring: ${formatCeoCurrency(revenue.recurringRevenue)}\n` +
    `One-time: ${formatCeoCurrency(revenue.oneTimeRevenue)}\n` +
    (revenue.byTier.length > 0
      ? `By tier: ${revenue.byTier.map((t) => `${t.tier}: ${formatCeoCurrency(t.revenue)}`).join(', ')}`
      : 'No license data available for this period.')
  );
}
