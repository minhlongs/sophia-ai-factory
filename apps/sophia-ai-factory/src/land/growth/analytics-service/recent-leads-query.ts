/**
 * Recent Leads Query Helper for Growth Analytics Service.
 * @module land/growth/analytics-service/recent-leads-query
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { RecentGrowthLeadItem } from '@/seed/types/solutions-types';

export async function fetchRecentLeads(db: D1Database): Promise<RecentGrowthLeadItem[]> {
  const recentLeads: RecentGrowthLeadItem[] = [];
  try {
    const recentStmt = db.prepare(
      'SELECT id, source, niche, status, lead_score, created_at, telegram_username FROM growth_leads ORDER BY created_at DESC LIMIT 10',
    );
    const rows = await recentStmt.all<{
      id: string;
      source: string;
      niche: string | null;
      status: string;
      lead_score: number;
      created_at: number;
      telegram_username: string | null;
    }>();
    if (rows.results) {
      for (const r of rows.results) {
        recentLeads.push({
          id: r.id,
          source: r.source,
          nameOrChat: r.telegram_username ? `@${r.telegram_username}` : `lead_${r.id.slice(0, 6)}`,
          niche: r.niche || 'general',
          score: r.lead_score || 50,
          status: (r.status as RecentGrowthLeadItem['status']) || 'new',
          createdAt: new Date(r.created_at).toISOString(),
        });
      }
    }
  } catch {
    // Non-fatal
  }
  return recentLeads;
}
