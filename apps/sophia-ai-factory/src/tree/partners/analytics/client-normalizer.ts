/**
 * Client Subscription Normalization & Activity Mapping.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/analytics/client-normalizer
 */

import type { ClientSubscriptionRecord } from './types';
import { formatYearMonth } from './date-utils';

export interface NormalizedClient {
  clientId: string;
  cohortMonth: string;
  activityMap: Map<string, number>; // month -> mrrCents
  isCurrentlyActive: boolean;
  currentMrrCents: number;
  totalRevenueCents: number;
}

function populateOrdersAndHistory(client: ClientSubscriptionRecord, activityMap: Map<string, number>): void {
  if (client.orders) {
    for (const order of client.orders) {
      const m = formatYearMonth(order.timestamp);
      const existing = activityMap.get(m) ?? 0;
      activityMap.set(m, existing + Math.max(0, order.mrrCents));
    }
  }

  if (client.monthlyHistory) {
    for (const hist of client.monthlyHistory) {
      const m = formatYearMonth(hist.month);
      const existing = activityMap.get(m) ?? 0;
      activityMap.set(m, Math.max(existing, Math.max(0, hist.mrrCents)));
    }
  }
}

function determineCohortMonth(client: ClientSubscriptionRecord, activityMap: Map<string, number>): string {
  if (client.firstOrderAt) {
    return formatYearMonth(client.firstOrderAt);
  }
  if (activityMap.size > 0) {
    const sortedMonths = Array.from(activityMap.keys()).sort();
    return sortedMonths[0];
  }
  return formatYearMonth(Date.now());
}

function determineCurrentActivity(
  client: ClientSubscriptionRecord,
  activityMap: Map<string, number>,
): { isCurrentlyActive: boolean; currentMrrCents: number } {
  let isCurrentlyActive = client.status === 'active';
  let currentMrrCents = client.currentMrrCents ?? 0;

  if (activityMap.size > 0) {
    const sortedMonths = Array.from(activityMap.keys()).sort();
    const latestMonth = sortedMonths[sortedMonths.length - 1];
    const latestMrr = activityMap.get(latestMonth) ?? 0;

    if (client.status === undefined) {
      isCurrentlyActive = latestMrr > 0;
    }
    if (client.currentMrrCents === undefined) {
      currentMrrCents = latestMrr;
    }
  }
  return { isCurrentlyActive, currentMrrCents };
}

export function normalizeSingleClient(client: ClientSubscriptionRecord): NormalizedClient {
  const activityMap = new Map<string, number>();
  populateOrdersAndHistory(client, activityMap);

  const cohortMonth = determineCohortMonth(client, activityMap);
  const initialMrr = client.currentMrrCents ?? 0;
  if (!activityMap.has(cohortMonth) && initialMrr > 0) {
    activityMap.set(cohortMonth, initialMrr);
  }

  const { isCurrentlyActive, currentMrrCents } = determineCurrentActivity(client, activityMap);

  let totalRevenueCents = 0;
  for (const cents of activityMap.values()) {
    totalRevenueCents += cents;
  }

  return {
    clientId: client.clientId,
    cohortMonth,
    activityMap,
    isCurrentlyActive,
    currentMrrCents,
    totalRevenueCents,
  };
}

export function groupClientsByCohortMonth(clients: NormalizedClient[]): Map<string, NormalizedClient[]> {
  const cohortGroups = new Map<string, NormalizedClient[]>();
  for (const client of clients) {
    const list = cohortGroups.get(client.cohortMonth) ?? [];
    list.push(client);
    cohortGroups.set(client.cohortMonth, list);
  }
  return cohortGroups;
}
