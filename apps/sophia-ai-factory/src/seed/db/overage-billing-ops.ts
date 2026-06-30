/**
 * Overage billing database operations.
 *
 * Moved from forest/quota/overage-logger-ops.ts to seed/ per layer architecture:
 * these are pure data operations (DB updates), not infrastructure orchestration.
 *
 * @module seed/db/overage-billing-ops
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'

/**
 * Mark overage events as billable after a successful top-up.
 * Returns the count of events marked, or 0 on error.
 */
export async function markEventsAsBillable(
  eventIds: string[],
  pricePerCredit: number,
): Promise<number> {
  if (eventIds.length === 0) return 0
  try {
    const db = createServerClient()
    await db.from('overage_events').update({ billable: true }).in('id', eventIds)
    logger.info('[Overage Billing] Marked events as billable', { count: eventIds.length, pricePerCredit })
    return eventIds.length
  } catch (error) {
    logger.error('[Overage Billing] Error marking events as billable', toError(error))
    return 0
  }
}
