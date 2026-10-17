/**
 * @file fleet-deployment-mutations.ts
 * @description Mutation operations for registering fleet accounts and launching staggered campaigns
 */

import { createServerClient } from '@/seed/db/client';
import {
  FleetCreatorAccountSchema,
  type FleetCreatorAccount,
} from '@/seed/types/fleet-matrix-sku-radar-types';
import type { RegisterFleetAccountInput } from './types';

export { executeLaunchFleetDeployment } from './fleet-deployment-launch';

export async function executeRegisterFleetAccount(
  userId: string,
  input: RegisterFleetAccountInput,
): Promise<{ success: boolean; data?: FleetCreatorAccount; error?: string }> {
  try {
    const accountId = `facc-${crypto.randomUUID().slice(0, 12)}`;
    const now = Math.floor(Date.now() / 1000);

    const validated = FleetCreatorAccountSchema.parse({
      id: accountId,
      userId,
      platform: input.platform,
      handle: input.handle,
      displayName: input.displayName,
      proxyConfigId: input.proxyConfigId ?? null,
      status: 'ACTIVE',
      dailyPostLimit: input.dailyPostLimit ?? 3,
      postsPublishedToday: 0,
      lastPostAt: null,
      totalViews: 0,
      totalClicks: 0,
      totalGmv: 0,
      totalCommission: 0,
      createdAt: now,
      updatedAt: now,
    });

    const db = createServerClient();
    await db.execute(
      `INSERT INTO fleet_creator_accounts (
        id, user_id, platform, handle, display_name, proxy_config_id,
        status, daily_post_limit, posts_published_today, last_post_at,
        total_views, total_clicks, total_gmv, total_commission,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validated.id,
        validated.userId,
        validated.platform,
        validated.handle,
        validated.displayName,
        validated.proxyConfigId ?? null,
        validated.status,
        validated.dailyPostLimit,
        validated.postsPublishedToday,
        validated.lastPostAt ?? null,
        validated.totalViews,
        validated.totalClicks,
        validated.totalGmv,
        validated.totalCommission,
        validated.createdAt,
        validated.updatedAt,
      ],
    );

    return { success: true, data: validated };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'FAILED_TO_REGISTER_ACCOUNT',
    };
  }
}
