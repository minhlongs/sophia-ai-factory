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

import { createServerClient } from '@/seed/db/client';
import { createLogger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { CampaignStatus } from '@/seed/types';

// ── Logger ───────────────────────────────────────────────────────────────────

const log = createLogger('tree/agents/ceo-executor');

// ── Types ────────────────────────────────────────────────────────────────────

export interface CampaignSummary {
  id: string;
  title: string;
  status: CampaignStatus;
  progress: number;
  topic: string | null;
  audience: string | null;
  createdAt: string;
}

export interface RevenueSummary {
  periodLabel: string;
  totalRevenue: number;
  recurringRevenue: number;
  oneTimeRevenue: number;
  byTier: { tier: string; customers: number; revenue: number }[];
  trend: { date: string; revenue: number }[];
}

export interface CeoContext {
  /** Human-readable context summary for LLM injection */
  summary: string;
  /** Structured data for the LLM to reference */
  campaigns?: CampaignSummary[];
  revenue?: RevenueSummary;
  /** Whether a write action was performed (campaign created, etc.) */
  actionResult?: string;
  /** Detected intent type */
  intent: CeoIntentType;
}

export type CeoIntentType =
  | 'list_campaigns'
  | 'get_campaign_status'
  | 'create_campaign'
  | 'revenue_insights'
  | 'general_query';

// ── Intent Detection ─────────────────────────────────────────────────────────

/** Keywords mapping Vietnamese + English to intent types */
const INTENT_PATTERNS: { type: CeoIntentType; patterns: RegExp[] }[] = [
  {
    type: 'list_campaigns',
    patterns: [
      /(?:list|show|get|all|my|những|tất cả|các)\s*(?:campaign|chiến dịch|dịch)/i,
      /campaigns?\s*(?:status|list|dashboard)/i,
      /chiến dịch (?:của tôi|đã tạo|hiện có)/i,
    ],
  },
  {
    type: 'get_campaign_status',
    patterns: [
      /(?:how is|status|check|kiểm tra|xem|trạng thái)\s*(?:campaign|chiến dịch)/i,
      /(?:campaign|chiến dịch)\s*(?:status|đang|progress|tiến độ)/i,
      /(?:summer|sale|new|mới)\s*(?:campaign|chiến dịch)/i,
    ],
  },
  {
    type: 'create_campaign',
    patterns: [
      /(?:run|create|start|make|new|tạo|chạy|bắt đầu|khởi tạo)\s*(?:a\s*)?(?:campaign|chiến dịch)/i,
      /(?:tạo|chạy|khởi động)\s*(?:chiến dịch|campaign)/i,
    ],
  },
  {
    type: 'revenue_insights',
    patterns: [
      /(?:revenue|doanh thu|profit|lợi nhuận|income|thu nhập|earnings)/i,
      /(?:how much|bao nhiêu|tổng|total)\s*(?:revenue|money|tiền|doanh thu)/i,
      /(?:why|tại sao)\s*(?:revenue|down|giảm|drop)/i,
      /(?:MRR|ARR|recurring|định kỳ)/i,
    ],
  },
];

function detectIntent(input: string): CeoIntentType {
  for (const entry of INTENT_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(input)) {
        return entry.type;
      }
    }
  }
  return 'general_query';
}

// ── Campaign Data ────────────────────────────────────────────────────────────

interface CampaignRow {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  audience: string | null;
  status: string;
  progress: number;
  created_at: string;
}

function mapCampaign(row: CampaignRow): CampaignSummary {
  return {
    id: row.id,
    title: row.title,
    status: row.status as CampaignStatus,
    progress: row.progress,
    topic: row.topic,
    audience: row.audience,
    createdAt: row.created_at,
  };
}

async function fetchCampaigns(userId: string): Promise<CampaignSummary[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from('campaigns')
    .select('id, user_id, title, topic, audience, status, progress, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    log.error('[ceo-executor] Failed to fetch campaigns', { message: String(error), code: (error as { code?: string }).code ?? 'unknown' });
    return [];
  }

  return ((data ?? []) as unknown[] as CampaignRow[]).map(mapCampaign);
}

async function fetchRecentCampaigns(userId: string, count = 5): Promise<CampaignSummary[]> {
  const all = await fetchCampaigns(userId);
  return all.slice(0, count);
}

// ── Revenue Data ─────────────────────────────────────────────────────────────

interface LicenseRevenueRow {
  tier: string | null;
  created_at: number;
  metadata: Record<string, unknown> | null;
}

interface PaymentEventRow {
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

function resolvePeriodLabel(input: string): string {
  const lower = input.toLowerCase();
  if (/week|tuần|7\s*day/i.test(lower)) return 'last_7_days';
  if (/month|tháng|30\s*day/i.test(lower)) return 'last_30_days';
  if (/this month|tháng này|current/i.test(lower)) return 'current_month';
  if (/last month|tháng trước/i.test(lower)) return 'last_month';
  return 'current_month';
}

async function fetchRevenue(input: string, _userId: string): Promise<RevenueSummary | null> {
  const periodLabel = resolvePeriodLabel(input);
  const db = createServerClient();
  const now = Date.now();

  // Resolve time boundaries
  let startTimestamp: number;
  let endTimestamp = Math.floor(now / 1000);

  const d = new Date();
  switch (periodLabel) {
    case 'current_month':
      startTimestamp = Math.floor(new Date(d.getFullYear(), d.getMonth(), 1).getTime() / 1000);
      break;
    case 'last_month':
      startTimestamp = Math.floor(new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime() / 1000);
      endTimestamp = Math.floor(new Date(d.getFullYear(), d.getMonth(), 0).getTime() / 1000);
      break;
    case 'last_7_days':
      startTimestamp = endTimestamp - 7 * 86400;
      break;
    case 'last_30_days':
    default:
      startTimestamp = endTimestamp - 30 * 86400;
  }

  // Fetch licenses relevant to this user's org
  const { data: licenses } = await db
    .from('raas_licenses')
    .select('tier, created_at, metadata')
    .gte('created_at', startTimestamp)
    .lte('created_at', endTimestamp);

  let totalRevenue = 0;
  let recurringRevenue = 0;
  let oneTimeRevenue = 0;
  const byTierMap = new Map<string, { customers: number; revenue: number }>();

  if (licenses && (licenses as unknown[] as LicenseRevenueRow[]).length > 0) {
    for (const license of (licenses as unknown[] as LicenseRevenueRow[])) {
      const tier = license.tier || 'BASIC';
      const entry = byTierMap.get(tier) ?? { customers: 0, revenue: 0 };
      entry.customers += 1;

      const meta = license.metadata as Record<string, unknown> | null;
      const mrr = typeof meta?.mrr_usd === 'number' ? meta.mrr_usd
        : typeof meta?.subscription_amount === 'number' ? meta.subscription_amount
        : 0;

      if (meta?.is_subscription) {
        entry.revenue += mrr;
        recurringRevenue += mrr;
      } else {
        oneTimeRevenue += mrr;
      }
      totalRevenue += mrr;
      byTierMap.set(tier, entry);
    }
  }

  // Fetch payment events for trend
  const { data: paymentEvents } = await db
    .from('payment_events')
    .select('event_type, payload, created_at')
    .gte('created_at', new Date(startTimestamp * 1000).toISOString())
    .lte('created_at', new Date(endTimestamp * 1000).toISOString())
    .eq('processed', true);

  const trendMap = new Map<string, number>();
  if (paymentEvents && (paymentEvents as unknown[] as PaymentEventRow[]).length > 0) {
    for (const evt of (paymentEvents as unknown[] as PaymentEventRow[])) {
      const date = evt.created_at.split('T')[0];
      const payload = evt.payload as Record<string, unknown> | null;
      const amountPayload = payload?.amount as Record<string, unknown> | undefined;
      const usdPayload = amountPayload?.usd as Record<string, unknown> | undefined;
      const amount = typeof usdPayload?.amount === 'number' ? usdPayload.amount : 0;
      trendMap.set(date, (trendMap.get(date) || 0) + amount);
    }
  }

  const trend = Array.from(trendMap.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byTier = Array.from(byTierMap.entries())
    .map(([tier, data]) => ({ tier, customers: data.customers, revenue: data.revenue }))
    .filter((t) => t.customers > 0 || t.revenue > 0);

  const displayPeriod = periodLabel.replace(/_/g, ' ');

  return {
    periodLabel: displayPeriod,
    totalRevenue,
    recurringRevenue,
    oneTimeRevenue,
    byTier,
    trend,
  };
}

// ── Create Campaign ──────────────────────────────────────────────────────────

async function createCampaignForUser(
  userId: string,
  input: string,
  _orgId: string,
): Promise<string> {
  // Extract title/topic from natural language using simple heuristics
  let title = '';
  let topic = '';
  let audience = 'General';

  // Try to extract the topic after keywords
  const aboutMatch = input.match(/(?:about|về|topic|chủ đề)\s+(.+?)(?:\.|$|với|cho|audience)/i);
  if (aboutMatch) {
    title = aboutMatch[1].trim();
    topic = title;
  } else {
    // Fallback: take meaningful text after "campaign" keyword
    const afterCampaign = input.match(/(?:campaign|chiến dịch)\s+(?:about|về|for|cho|trên)?\s*(.+?)(?:\.|$)/i);
    if (afterCampaign) {
      title = afterCampaign[1].trim();
      topic = title;
    } else {
      // Last resort: use first meaningful segment
      const words = input.replace(/^(?:run|create|start|make|new|tạo|chạy|bắt đầu)\s+(?:a\s+)?(?:campaign|chiến dịch)\s+/i, '').trim();
      title = words.slice(0, 100) || 'New Campaign';
      topic = title;
    }
  }

  // Extract audience if mentioned
  const audienceMatch = input.match(/(?:audience|đối tượng|target|nhắm)\s+(?:là|is|to|vào)?\s*(.+?)(?:\.|$)/i);
  if (audienceMatch) {
    audience = audienceMatch[1].trim();
  }

  const db = createServerClient();
  const campaignId = crypto.randomUUID();

  const { error } = await db.from('campaigns').insert({
    id: campaignId,
    user_id: userId,
    title: title.slice(0, 255),
    topic: topic.slice(0, 500),
    audience: audience.slice(0, 500),
    status: 'queued',
    progress: 0,
  });

  if (error) {
    log.error('[ceo-executor] Failed to create campaign', { message: String(error), code: (error as { code?: string }).code ?? 'unknown' });
    throw new Error(`Failed to create campaign: ${getErrorMessage(error)}`);
  }

  // Fire-and-forget Inngest event if available
  try {
    const { inngest } = await import('@/tree/inngest/client');
    await inngest.send({
      name: 'campaign.created',
      data: {
        campaignId,
        userId,
        topic,
        audience,
        tier: 'BASIC' as const,
      },
    });
  } catch {
    // Inngest not configured — campaign is still created
    log.info('[ceo-executor] Inngest not available, campaign created without event');
  }

  return `Campaign "${title}" đã được tạo (created) với ID: ${campaignId}. Trạng thái: queued. Target audience: ${audience}. Topic: ${topic}.`;
}

// ── Main Executor ────────────────────────────────────────────────────────────

/**
 * Execute CEO agent context injection.
 *
 * Detects intent from user input, fetches relevant data,
 * and returns enriched context for the LLM.
 */
export async function executeCeoContext(
  input: string,
  userId: string,
  _orgId: string,
): Promise<CeoContext> {
  const intent = detectIntent(input);
  log.info('[ceo-executor] Detected intent', { intent, inputPreview: input.slice(0, 80) });

  switch (intent) {
    case 'list_campaigns': {
      const campaigns = await fetchCampaigns(userId);
      if (campaigns.length === 0) {
        return {
          intent,
          summary: 'User has no campaigns yet. Suggest creating one.',
          campaigns: [],
        };
      }

      const lines = campaigns.map(
        (c) => `- [${c.status}] ${c.title} (${Math.round(c.progress)}%) — created ${new Date(c.createdAt).toLocaleDateString()}`,
      );

      return {
        intent,
        summary: `User has ${campaigns.length} campaigns:\n${lines.join('\n')}`,
        campaigns,
      };
    }

    case 'get_campaign_status': {
      const campaigns = await fetchRecentCampaigns(userId, 10);
      if (campaigns.length === 0) {
        return {
          intent,
          summary: 'No campaigns found for this user.',
          campaigns: [],
        };
      }

      const lines = campaigns.map((c) => {
        const statusLabel = c.status === 'completed' ? 'Hoàn thành (Completed)' :
          c.status === 'failed' ? 'Thất bại (Failed)' :
          c.status === 'queued' ? 'Đang chờ (Queued)' :
          c.status === 'processing_script' ? 'Đang tạo kịch bản' :
          c.status === 'processing_video' ? 'Đang tạo video' :
          c.status;
        return `- **${c.title}**: ${statusLabel} — ${Math.round(c.progress)}% hoàn thành`;
      });

      return {
        intent,
        summary: `Campaign status:\n${lines.join('\n')}`,
        campaigns,
      };
    }

    case 'create_campaign': {
      try {
        const result = await createCampaignForUser(userId, input, _orgId);
        return {
          intent,
          summary: result,
          actionResult: result,
        };
      } catch (err) {
        const errMsg = getErrorMessage(err);
        log.error('[ceo-executor] Campaign creation failed', err instanceof Error ? err : new Error(errMsg));
        return {
          intent,
          summary: `Failed to create campaign: ${errMsg}`,
        };
      }
    }

    case 'revenue_insights': {
      const revenue = await fetchRevenue(input, userId);
      if (!revenue || revenue.totalRevenue === 0) {
        return {
          intent,
          summary: 'No revenue data available for the selected period. The user may not have any active subscriptions or payments yet.',
          revenue: revenue ?? { periodLabel: 'current', totalRevenue: 0, recurringRevenue: 0, oneTimeRevenue: 0, byTier: [], trend: [] },
        };
      }

      const tierLines = revenue.byTier.map(
        (t) => `- ${t.tier}: ${t.customers} customers, $${t.revenue.toFixed(2)}`,
      ).join('\n');

      const trendLines = revenue.trend.slice(-7).map(
        (t) => `- ${t.date}: $${t.revenue.toFixed(2)}`,
      ).join('\n');

      const summary =
        `Revenue data for period: ${revenue.periodLabel}\n` +
        `- Tổng doanh thu (Total Revenue): $${revenue.totalRevenue.toFixed(2)}\n` +
        `- Doanh thu định kỳ (Recurring/MRR): $${revenue.recurringRevenue.toFixed(2)}\n` +
        `- Doanh thu một lần (One-time): $${revenue.oneTimeRevenue.toFixed(2)}\n\n` +
        `By tier:\n${tierLines}\n\n` +
        `Recent trend (last 7 days):\n${trendLines || '(no daily data)'}`;

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
