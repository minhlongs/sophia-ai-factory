/**
 * Fair-Share Video Queue Tier Priority Calculator
 *
 * Layer: land/video/queue-actions
 */

import type { QueueLane } from '@/seed/types/video-render-queue';
import type { VideoTierPriority } from './types';

/**
 * Assigns queue lane and priority score based on subscription tier.
 * Enterprise & Master tiers receive the expedited priority lane.
 */
export function resolveTierPriority(tier: string): VideoTierPriority {
  const upperTier = tier.toUpperCase();

  if (upperTier === 'MASTER') {
    return { lane: 'priority', priorityScore: 200 };
  }
  if (upperTier === 'ENTERPRISE') {
    return { lane: 'priority', priorityScore: 100 };
  }
  if (upperTier === 'AGENCY') {
    return { lane: 'standard', priorityScore: 50 };
  }
  if (upperTier === 'PREMIUM' || upperTier === 'PRO') {
    return { lane: 'standard', priorityScore: 25 };
  }
  return { lane: 'standard', priorityScore: 10 };
}
