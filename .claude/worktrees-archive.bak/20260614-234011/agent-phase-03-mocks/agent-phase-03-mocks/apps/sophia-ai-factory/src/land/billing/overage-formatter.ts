/**
 * Overage Formatter
 *
 * Utilities for formatting overage events for API responses
 * - formatOverageEvents
 * - calculateOverageTotals
 * - filterBillableEvents
 *
 * @module overage/overage-formatter
 */

import type { OverageEvent } from '@/seed/types/billing-contracts';

/**
 * Formatted overage event for API response
 */
export interface FormattedOverageEvent {
  id: string;
  exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  exceededLimit: number;
  exceededCurrent: number;
  exceededBy: number;
  requestedCredits: number;
  endpoint: string | null;
  service: string | null;
  action: string | null;
  billable: boolean;
  createdAt: string;
}

/**
 * Overage totals for API response
 */
export interface OverageTotals {
  totalOverage: number;
  billedOverage: number;
  unbilledOverage: number;
  totalEvents: number;
  billableEvents: number;
}

/**
 * Format single overage event for API response
 *
 * @param event - Raw overage event
 * @returns Formatted event
 */
export function formatOverageEvent(event: OverageEvent): FormattedOverageEvent {
  return {
    id: event.id,
    exceededType: event.exceededType as FormattedOverageEvent['exceededType'],
    exceededLimit: event.exceededLimit,
    exceededCurrent: event.exceededCurrent,
    exceededBy: event.exceededBy,
    requestedCredits: event.requestedCredits,
    endpoint: event.endpoint ?? null,
    service: event.serviceName ?? null,
    action: event.action ?? null,
    billable: event.billable,
    createdAt: new Date(event.createdAt).toISOString(),
  };
}

/**
 * Format array of overage events
 *
 * @param events - Array of raw events
 * @returns Array of formatted events
 */
export function formatOverageEvents(events: OverageEvent[]): FormattedOverageEvent[] {
  return events.map(formatOverageEvent);
}

/**
 * Calculate overage totals
 *
 * @param events - Array of overage events
 * @returns Totals object
 */
export function calculateOverageTotals(events: OverageEvent[]): OverageTotals {
  return events.reduce(
    (acc, event) => {
      acc.totalEvents += 1;
      acc.totalOverage += event.exceededBy;

      if (event.billable) {
        acc.billedOverage += event.exceededBy;
        acc.billableEvents += 1;
      } else {
        acc.unbilledOverage += event.exceededBy;
      }

      return acc;
    },
    {
      totalOverage: 0,
      billedOverage: 0,
      unbilledOverage: 0,
      totalEvents: 0,
      billableEvents: 0,
    }
  );
}

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
