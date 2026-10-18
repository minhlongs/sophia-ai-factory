/**
 * Overage Event Filtering & Grouping Utilities
 *
 * - filterByBillableStatus
 * - filterByType
 * - groupEventsByDate
 *
 * @module land/billing/overage-filters
 */

import type { OverageEvent } from '@/seed/types/billing-contracts';

/**
 * Filter events by billable status
 *
 * @param events - Array of events
 * @param billable - Filter by billable status
 * @returns Filtered events
 */
export function filterByBillableStatus(
  events: OverageEvent[],
  billable: boolean
): OverageEvent[] {
  return events.filter(event => event.billable === billable);
}

/**
 * Filter events by type
 *
 * @param events - Array of events
 * @param type - Exceeded type to filter
 * @returns Filtered events
 */
export function filterByType(
  events: OverageEvent[],
  type: string
): OverageEvent[] {
  return events.filter(event => event.exceededType === type);
}

/**
 * Group events by date
 *
 * @param events - Array of events
 * @returns Events grouped by date (YYYY-MM-DD)
 */
export function groupEventsByDate(events: OverageEvent[]): Record<string, OverageEvent[]> {
  return events.reduce((acc, event) => {
    const date = new Date(event.createdAt).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, OverageEvent[]>);
}
