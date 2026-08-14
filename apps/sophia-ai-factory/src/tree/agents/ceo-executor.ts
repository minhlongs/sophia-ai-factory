/**
 * CEO Agent — Campaign Management + Revenue Insights Executor
 *
 * Detects intent from natural language input and fetches relevant data
 * for the CEO agent to produce bilingual (Vietnamese + English) responses.
 *
 * Layer: tree → imports seed only (OK)
 * - Campaign data: D1 campaigns table via createServerClient()
 * - Revenue data: raas_licenses + payment_events tables via createServerClient()
 */

import { createLogger } from '@/seed/utils/logger-utility';
import { detectIntent } from './ceo-intent-detector';
import { fetchRecentCampaigns, fetchCampaigns, createCampaignForUser } from './ceo-campaign-data';
import { fetchRevenue } from './ceo-revenue-data';
import type { CeoContext } from './ceo-intent-types';

// ── Re-exports ────────────────────────────────────────────────────────────────
export type {
  CeoIntent,
  CampaignSummary,
  RevenueInsights,
  RevenueByTier,
  RevenueTrendPoint,
  CeoContext,
} from './ceo-intent-types';
export { detectIntent, extractTopicFromInput } from './ceo-intent-detector';
export { fetchRecentCampaigns, fetchCampaigns, createCampaignForUser } from './ceo-campaign-data';
export { fetchRevenue } from './ceo-revenue-data';

const log = createLogger('ceo-executor');

/**
 * Format a currency value for bilingual display.
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Map campaign status to bilingual label.
 */
function formatStatus(status: string): string {
  switch (status) {
    case 'pending': return 'Chờ xử lý (Pending)';
    case 'running': return 'Đang chạy (Running)';
    case 'completed': return 'Hoàn thành (Completed)';
    case 'failed': return 'Thất bại (Failed)';
    default: return status;
  }
}

/**
 * Main entry point: detect intent from user input and enrich with data.
 *
 * This function is the single orchestration point that:
 * 1. Fetches existing campaigns for context
 * 2. Detects user intent from natural language
 * 3. Fetches or creates data based on intent
 * 4. Returns a structured context for the CEO agent response
 */
export async function executeCeoContext(
  input: string,
  userId: string,
  _orgId: string,
): Promise<CeoContext> {
  const campaigns = await fetchRecentCampaigns(userId, 10);
  const { intent, topic } = detectIntent(input, campaigns);

  log.info('[ceo-executor] Intent detected', { intent, userId });

  switch (intent) {
    case 'list_campaigns': {
      const allCampaigns = await fetchCampaigns(userId);
      const summary = allCampaigns.length > 0
        ? `Found ${allCampaigns.length} campaigns:\n` +
          allCampaigns.map((c) => `- ${c.title} (${formatStatus(c.status as string)})`).join('\n')
        : 'No campaigns found. Create one with "create campaign [topic]"!';

      return { intent, summary, campaigns: allCampaigns };
    }

    case 'get_campaign_status': {
      const match = campaigns.find((c) => c.id === topic || c.title.toLowerCase() === topic?.toLowerCase());
      if (match) {
        return {
          intent,
          summary: `Campaign "${match.title}" status: ${formatStatus(match.status as string)} (${match.progress}% complete)`,
          campaigns: [match],
        };
      }
      return {
        intent,
        summary: 'Could not find a matching campaign. Here are your recent campaigns:\n' +
          campaigns.map((c) => `- ${c.title}`).join('\n'),
        campaigns,
      };
    }

    case 'create_campaign': {
      const campaignTitle = topic ?? 'New Campaign';
      const result = await createCampaignForUser(userId, campaignTitle, campaignTitle, '');

      if ('error' in result) {
        return {
          intent,
          summary: `Failed to create campaign: ${result.error}`,
          actionResult: 'error',
        };
      }

      return {
        intent,
        summary: `Campaign "${campaignTitle}" created successfully! (ID: ${result.id})`,
        actionResult: result.id,
      };
    }

    case 'revenue_insights': {
      const revenue = await fetchRevenue(topic ?? 'last_30_days', userId);

      const summary =
        `Revenue insights (${revenue.periodLabel}):\n` +
        `Total: ${formatCurrency(revenue.totalRevenue)}\n` +
        `Recurring: ${formatCurrency(revenue.recurringRevenue)}\n` +
        `One-time: ${formatCurrency(revenue.oneTimeRevenue)}\n` +
        (revenue.byTier.length > 0
          ? `By tier: ${revenue.byTier.map((t) => `${t.tier}: ${formatCurrency(t.revenue)}`).join(', ')}`
          : 'No license data available for this period.');

      return {
        intent,
        summary,
        revenue,
      };
    }

    case 'general_query':
    default: {
      return {
        intent,
        summary: 'No specific data context needed. Provide general business analysis.',
      };
    }
  }
}
