/**
 * GET /api/raas/templates — list active mission templates
 *
 * Returns mission templates with MCU cost and category info.
 * Auth: Supabase session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/better-auth-session';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import { UNIFIED_TIERS } from '@/config/tiers';
import type { Tier } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = createServerClient();

    // Try fetching from DB first; fall back to static list if table doesn't exist yet
    const { data: templates, error } = await db
      .from('mission_templates')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true });

    if (error) {
      logger.warn('[GET /api/raas/templates] Table not found, using static templates', toError(error));
      return NextResponse.json({ templates: STATIC_TEMPLATES });
    }

    return NextResponse.json({ templates: templates ?? STATIC_TEMPLATES });
  } catch (err) {
    logger.error('[GET /api/raas/templates] Error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── Static fallback templates ──────────────────────────────────────────────────

const STATIC_TEMPLATES = [
  { id: 'proposal:create',          name: 'Proposal',           command: 'proposal:create',          category: 'proposal', mcu_cost: 25,  icon: 'description',     description: 'AI-written sales proposal',    is_active: true },
  { id: 'sales:proposal-deck',      name: 'Sales Deck',         command: 'sales:proposal-deck',      category: 'sales',    mcu_cost: 10,  icon: 'slideshow',       description: 'Full proposal deck',           is_active: true },
  { id: 'sales:roi-calculator',     name: 'ROI Calculator',     command: 'sales:roi-calculator',     category: 'sales',    mcu_cost: 5,   icon: 'calculate',       description: 'ROI projection for prospects', is_active: true },
  { id: 'sales:competitor-analysis',name: 'Competitor Intel',   command: 'sales:competitor-analysis',category: 'sales',    mcu_cost: 8,   icon: 'query_stats',     description: 'SWOT analysis',                is_active: true },
  { id: 'sales:outreach-sequence',  name: 'Outreach Sequence',  command: 'sales:outreach-sequence',  category: 'sales',    mcu_cost: 8,   icon: 'forward_to_inbox',description: 'Email + LinkedIn outreach',    is_active: true },
  { id: 'content:blog',             name: 'Blog Post',          command: 'content:blog',             category: 'content',  mcu_cost: 50,  icon: 'article',         description: 'SEO-optimized blog article',   is_active: true },
  { id: 'content:social',           name: 'Social Bundle',      command: 'content:social',           category: 'content',  mcu_cost: 10,  icon: 'share',           description: 'LinkedIn + Twitter + TikTok', is_active: true },
  { id: 'video:create',             name: 'Intro Video',        command: 'video:create',             category: 'video',    mcu_cost: 100, icon: 'play_circle',     description: '30s HeyGen intro video',       is_active: true },
  { id: 'lead:generate',            name: 'Lead Generation',    command: 'lead:generate',            category: 'leads',    mcu_cost: 30,  icon: 'group_add',       description: 'Generate qualified leads',     is_active: true },
  { id: 'email:send',               name: 'Email Campaign',     command: 'email:send',               category: 'email',    mcu_cost: 5,   icon: 'mail',            description: 'Automated email campaign',     is_active: true },
];

/**
 * Get MCU monthly limit for current user's tier (exported for reuse).
 */
export function getUserMcuLimit(tier: Tier): number {
  return UNIFIED_TIERS[tier].mcuMonthly;
}
