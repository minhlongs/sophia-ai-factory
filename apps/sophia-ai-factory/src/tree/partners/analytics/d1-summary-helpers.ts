/**
 * Database Query & Record Formatter Helpers for Partner Analytics Summary.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/analytics/d1-summary-helpers
 */

import type {
  ClientOrderRecord,
  ClientSubscriptionRecord,
  SubClientMetric,
} from './types';
import {
  fetchPartnerCommissions,
  fetchPartnerPoolStats,
  fetchPartnerProfile,
  type CommissionRow,
  type PoolRow,
  type ProfileRow,
} from './d1-summary-queries';

export {
  calculateRevenueGrowthPct,
  calculateCommissionsAndMrr,
} from './revenue-growth-helper';

export {
  fetchPartnerCommissions,
  fetchPartnerPoolStats,
  fetchPartnerProfile,
  type CommissionRow,
  type PoolRow,
  type ProfileRow,
};

export interface ClientGroupData {
  clientId: string;
  orders: ClientOrderRecord[];
  firstSeenAt: number;
  lastActiveAt: number;
  lifetimeMrrCents: number;
  lifetimeCommissionCents: number;
  currentMrrCents: number;
}

export function groupCommissionsByClient(commissions: CommissionRow[]): Map<string, ClientGroupData> {
  const clientMap = new Map<string, ClientGroupData>();

  for (const comm of commissions) {
    const existing = clientMap.get(comm.referred_user_id) ?? {
      clientId: comm.referred_user_id,
      orders: [],
      firstSeenAt: comm.created_at,
      lastActiveAt: comm.created_at,
      lifetimeMrrCents: 0,
      lifetimeCommissionCents: 0,
      currentMrrCents: comm.mrr_cents,
    };

    existing.orders.push({
      orderId: comm.order_id,
      timestamp: comm.created_at,
      mrrCents: comm.mrr_cents,
    });

    if (comm.created_at < existing.firstSeenAt) {
      existing.firstSeenAt = comm.created_at;
    }
    if (comm.created_at >= existing.lastActiveAt) {
      existing.lastActiveAt = comm.created_at;
      existing.currentMrrCents = comm.mrr_cents;
    }

    existing.lifetimeMrrCents += comm.mrr_cents;
    existing.lifetimeCommissionCents += comm.commission_cents;

    clientMap.set(comm.referred_user_id, existing);
  }

  return clientMap;
}

export function buildSubClientMetrics(
  clientMap: Map<string, ClientGroupData>,
  now: number,
): { subscriptionRecords: ClientSubscriptionRecord[]; subClientMetrics: SubClientMetric[] } {
  const subscriptionRecords: ClientSubscriptionRecord[] = [];
  const subClientMetrics: SubClientMetric[] = [];

  for (const [clientId, data] of clientMap.entries()) {
    subscriptionRecords.push({
      clientId,
      firstOrderAt: data.firstSeenAt,
      orders: data.orders,
      currentMrrCents: data.currentMrrCents,
      status: (now - data.lastActiveAt) < 60 * 86_400 * 1000 ? 'active' : 'churned',
    });

    const daysSinceFirst = Math.max(1, Math.floor((now - data.firstSeenAt) / (86_400 * 1000)));
    const estimatedDailyVelocity = Number((data.currentMrrCents / 100 / Math.min(30, daysSinceFirst)).toFixed(1));

    subClientMetrics.push({
      clientId,
      clientName: `Client ${clientId.slice(0, 8)}`,
      tier: 'Standard',
      totalOrders: data.orders.length,
      lifetimeMrrCents: data.lifetimeMrrCents,
      currentMrrCents: data.currentMrrCents,
      mcuBalance: Math.max(0, 500 - Math.floor(estimatedDailyVelocity * 7)),
      mcuVelocityDaily: estimatedDailyVelocity,
      runwayDays: estimatedDailyVelocity > 0 ? Math.floor(500 / estimatedDailyVelocity) : 999,
      status: (now - data.lastActiveAt) < 30 * 86_400 * 1000 ? 'healthy' : 'warning',
      firstSeenAt: data.firstSeenAt,
      lastActiveAt: data.lastActiveAt,
    });
  }

  return { subscriptionRecords, subClientMetrics };
}
