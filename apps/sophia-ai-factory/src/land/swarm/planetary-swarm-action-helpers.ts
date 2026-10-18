/**
 * planetary-swarm-action-helpers.ts — Internal execution and auth wrapper for Planetary Swarm 3.0 actions.
 * Layer: LAND (Helpers)
 */

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import type { PlanetarySwarmNode } from '@/seed/types/planetary-swarm';
import { PlanetarySwarmV3Coordinator } from '@/tree/swarm/planetary-swarm-v3-coordinator';

export interface SwarmActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Executes an authenticated Planetary Swarm operation with standardized error logging.
 */
export async function runAuthenticatedSwarmAction<T>(
  actionName: string,
  fallbackError: string,
  handler: () => Promise<T>,
): Promise<SwarmActionResponse<T>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required' };
    }

    const data = await handler();
    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : fallbackError;
    logger.error(`${actionName} failed`, { error: message });
    return { success: false, error: message };
  }
}

/**
 * Loads all planetary swarm nodes from D1 if available.
 */
export async function loadSwarmNodesFromD1(): Promise<PlanetarySwarmNode[]> {
  const db = await getD1();
  return db ? PlanetarySwarmV3Coordinator.getAllNodes(db) : [];
}
