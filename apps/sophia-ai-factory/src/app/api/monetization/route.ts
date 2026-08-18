/**
 * GET /api/monetization — Workspace monetization overview
 * Returns aggregate ROI, top channels, revenue attribution, and dynamic pricing info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getWorkspaceROI, getTopROIChannels } from '@/tree/roi';
import { aggregateRevenueAttribution } from '@/forest/analytics/queries/revenue-attribution';
import { getDynamicMultiplier } from '@/land/billing/dynamic-pricing-config';
import { VIDEO_MCU_COSTS } from '@/land/billing/video-mcu-cost-config';
import type { ROIAggregate } from '@/tree/roi';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  since: z.preprocess(
    (v) => (v == null ? undefined : Number(v)),
    z.number().int().positive().optional(),
  ),
});

async function verifyWorkspaceAccess(orgId: string, userId: string): Promise<boolean> {
  const db = createServerClient();
  if (!db) return false;
  try {
    const member = await db
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(orgId, userId)
      .first();
    return !!member;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      workspaceId: url.searchParams.get('workspaceId'),
      since: url.searchParams.get('since'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'workspaceId is required', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      );
    }

    const { workspaceId, since } = parsed.data;

    if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [roi, topChannels, revenueAttribution, tier] = await Promise.all([
      getWorkspaceROI(workspaceId, since ? { since } : undefined),
      getTopROIChannels(workspaceId, 5, since),
      aggregateRevenueAttribution(workspaceId, since ? { since } : undefined),
      getUserTier(user.id),
    ]);

    const roiData: ROIAggregate = roi ?? {
      workspaceId,
      totalRevenueCents: 0,
      totalCostCents: 0,
      roi: 0,
      unitCount: 0,
      avgRevenuePerUnit: 0,
      avgCostPerUnit: 0,
    };

    const multiplier = getDynamicMultiplier(tier, roiData.unitCount);
    const baseCostMCU = VIDEO_MCU_COSTS.VIDEO_CREATE;
    const adjustedCostMCU = Math.round(baseCostMCU * multiplier);

    const response = {
      aggregate: {
        totalRevenueCents: roiData.totalRevenueCents,
        totalCostCents: roiData.totalCostCents,
        roi: roiData.roi,
        unitCount: roiData.unitCount,
        avgRevenuePerUnit: roiData.avgRevenuePerUnit,
        avgCostPerUnit: roiData.avgCostPerUnit,
      },
      topChannels,
      revenueAttribution,
      dynamicPricing: {
        tier,
        baseCostMCU,
        adjustedCostMCU,
        multiplier,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    logger.error('[Monetization API] Unhandled error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json(
      { error: 'internal_error' },
      { status: 500 },
    );
  }
}
