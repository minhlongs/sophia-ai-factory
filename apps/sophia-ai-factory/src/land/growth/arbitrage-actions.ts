'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { Result, failure } from '@/seed/types/result';
import { createLogger } from '@/seed/utils/logger-utility';
import {
  evaluateAndCoordinateArbitrage,
  recalibratePlatforms,
  getArbitrageMetrics,
  type ArbitrageEvaluationResult,
  type ArbitrageDashboardMetrics,
  type DestinationPlatform,
} from './arbitrage-coordinator';

const logger = createLogger('land/growth/arbitrage-actions');

const PlatformMetricSchema = z.object({
  platform: z.enum(['TIKTOK', 'YOUTUBE_SHORTS', 'INSTAGRAM_REELS']),
  completionRate: z.number().min(0).max(1).optional(),
  rewatchRate: z.number().min(0).max(1).optional(),
  viewedVsSwipedRate: z.number().min(0).max(1).optional(),
  dmShareRate: z.number().min(0).max(1).optional(),
  saveRate: z.number().min(0).max(1).optional(),
});

export const ExecuteArbitrageInputSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  videoHook: z.string().min(3, 'Video hook must be at least 3 characters'),
  urgency: z.enum(['HIGH', 'NORMAL', 'LOW']).optional().default('NORMAL'),
  estimatedTokenCostUsd: z.number().positive().optional().default(1.2),
  metrics: z
    .object({
      TIKTOK: PlatformMetricSchema.optional(),
      YOUTUBE_SHORTS: PlatformMetricSchema.optional(),
      INSTAGRAM_REELS: PlatformMetricSchema.optional(),
    })
    .optional(),
});

export type ExecuteArbitrageInput = z.infer<typeof ExecuteArbitrageInputSchema>;

/**
 * Executes cross-platform virality arbitrage, calculates hook alignment,
 * determines opportunistic compute regime, and persists telemetry into D1.
 */
export async function executeArbitrageAction(
  rawInput: unknown
): Promise<Result<ArbitrageEvaluationResult, Error>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure(new Error('Unauthorized: User session required to execute arbitrage'));
    }

    const parseResult = ExecuteArbitrageInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((i) => i.message).join('; ');
      return failure(new Error(`Validation Error: ${errorMsg}`));
    }

    const { videoId, videoHook, urgency, estimatedTokenCostUsd, metrics } = parseResult.data;

    return await evaluateAndCoordinateArbitrage({
      tenantId: user.id,
      userId: user.id,
      videoId,
      videoHook,
      urgency,
      estimatedTokenCostUsd,
      metrics,
    });
  } catch (err) {
    logger.error('executeArbitrageAction failure', err instanceof Error ? err : new Error(String(err)));
    return failure(err instanceof Error ? err : new Error('Arbitrage execution failed'));
  }
}

/**
 * Recalibrates all connected social platforms with latest platform retention weights.
 */
export async function recalibrateAllPlatformsAction(): Promise<
  Result<{ recalibratedCount: number; platforms: DestinationPlatform[]; globalReachLift: number }, Error>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure(new Error('Unauthorized: User session required to recalibrate platforms'));
    }

    return await recalibratePlatforms(user.id);
  } catch (err) {
    logger.error('recalibrateAllPlatformsAction failure', err instanceof Error ? err : new Error(String(err)));
    return failure(err instanceof Error ? err : new Error('Failed to recalibrate platforms'));
  }
}

/**
 * Retrieves aggregate metrics for the CEO Cockpit HUD.
 */
export async function getArbitrageDashboardMetricsAction(): Promise<
  Result<ArbitrageDashboardMetrics, Error>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure(new Error('Unauthorized: User session required to fetch dashboard metrics'));
    }

    return await getArbitrageMetrics(user.id);
  } catch (err) {
    logger.error(
      'getArbitrageDashboardMetricsAction failure',
      err instanceof Error ? err : new Error(String(err))
    );
    return failure(err instanceof Error ? err : new Error('Failed to retrieve dashboard metrics'));
  }
}
