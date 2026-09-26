/**
 * Real-Time Partner Analytics & Cohort Reporting Engine
 *
 * Provides:
 * 1. Customer Cohort Matrix: Monthly retention matrix, logo retention, LTV, churn rate, and NRR.
 * 2. MCU Consumption Velocity: Rolling 7-day and 30-day consumption velocity, acceleration, and runway days.
 * 3. D1 Analytics Aggregator: Aggregates client metrics, top sub-clients, and revenue growth.
 *
 * Layer: tree/partners (Pure domain analytics & D1 queries — imports only from @/seed and @/tree/partners)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/partner-analytics
 */

import type { D1Database } from '@/seed/db/client';
import type { PartnerTier } from '@/tree/partners/types';

// ============================================================================
// Types & Contracts
// ============================================================================

export interface ClientOrderRecord {
  orderId?: string;
  timestamp: number | string; // ms timestamp or ISO string
  mrrCents: number;
}

export interface ClientMonthlyActivity {
  month: string; // "YYYY-MM"
  mrrCents: number;
  active?: boolean;
}

export interface ClientSubscriptionRecord {
  clientId: string;
  clientName?: string;
  firstOrderAt: number | string; // ms timestamp, ISO string, or "YYYY-MM"
  monthlyHistory?: ClientMonthlyActivity[];
  orders?: ClientOrderRecord[];
  currentMrrCents?: number;
  status?: 'active' | 'churned' | 'paused';
}

export interface CohortPeriodMetric {
  monthIndex: number; // 0 for cohort inception month, 1 for M+1, etc.
  activityMonth: string; // "YYYY-MM"
  activeClients: number;
  logoRetentionPct: number; // (activeClients / initialSize) * 100
  mrrCents: number;
  nrrPct: number; // (mrrCents / initialMrrCents) * 100
  logoChurnPct: number; // 100 - logoRetentionPct
  mrrChurnPct: number; // Math.max(0, 100 - nrrPct)
}

export interface CohortRow {
  cohortMonth: string; // "YYYY-MM"
  initialSize: number;
  initialMrrCents: number;
  totalRealizedRevenueCents: number;
  realizedLtvCents: number;
  periods: CohortPeriodMetric[];
}

export interface CohortSummary {
  totalClients: number;
  activeClients: number;
  totalMrrCents: number;
  avgLtvCents: number;
  projectedLtvCents: number;
  blendedChurnPct: number;
  avgM1RetentionPct: number;
  avgM3RetentionPct: number;
  overallNrrPct: number;
}

export interface CohortMatrixResult {
  cohorts: CohortRow[];
  summary: CohortSummary;
}

export interface McuLogRecord {
  id?: string;
  userId?: string;
  subaccountId?: string;
  timestamp: number | string; // ms timestamp or ISO string
  delta?: number; // negative for consumption (e.g. -50), or positive if mcuConsumed
  mcuConsumed?: number; // alternative explicit positive consumption
  reason?: string;
}

export interface McuVelocityResult {
  velocity7d: number; // Daily consumption rate over last 7 days (MCU/day)
  velocity30d: number; // Daily consumption rate over last 30 days (MCU/day)
  velocityWindowDays: number; // Daily consumption rate over custom windowDays (MCU/day)
  totalConsumedInWindow: number;
  totalConsumedLifetime: number;
  acceleration: number; // (V_7d - V_30d) / (V_30d + epsilon)
  trend: 'accelerating' | 'decelerating' | 'stable';
  currentBalance: number;
  runwayDays: number; // 999 if dormant
  exhaustionRisk: 'imminent' | 'warning' | 'healthy' | 'dormant';
}

export interface SubClientMetric {
  clientId: string;
  clientName: string;
  tier: string;
  totalOrders: number;
  lifetimeMrrCents: number;
  currentMrrCents: number;
  mcuBalance: number;
  mcuVelocityDaily: number;
  runwayDays: number;
  status: 'healthy' | 'warning' | 'imminent' | 'dormant';
  firstSeenAt: number;
  lastActiveAt: number;
}

export interface PartnerAnalyticsSummary {
  partnerId: string;
  partnerName: string;
  tier: PartnerTier;
  period: string; // e.g. "2026-09"
  generatedAt: number;
  totalSubClients: number;
  activeSubClients: number;
  totalMrrCents: number;
  monthlyCommissionCents: number;
  lifetimeEarningsCents: number;
  totalMcuAllocated: number;
  totalMcuConsumed: number;
  avgMcuVelocityDaily: number;
  avgLtvCents: number;
  blendedChurnPct: number;
  revenueGrowthPct: number;
  topSubClients: SubClientMetric[];
  cohortMatrix: CohortMatrixResult;
}

// ============================================================================
// Date & Month Normalization Utilities
// ============================================================================

/**
 * Normalizes any timestamp, date string, or month string into UTC "YYYY-MM"
 */
export function formatYearMonth(input: number | string | Date): string {
  if (typeof input === 'string') {
    if (/^\d{4}-\d{2}$/.test(input)) {
      return input;
    }
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 7);
    }
    // Fallback: check if starts with YYYY-MM
    const match = input.match(/^(\d{4})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }
  }

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 7);
  }
  return d.toISOString().slice(0, 7);
}

/**
 * Computes integer month difference: targetMonth - baseMonth
 * e.g. "2026-08" - "2026-06" = 2
 */
export function diffMonths(baseMonth: string, targetMonth: string): number {
  const [y1, m1] = baseMonth.split('-').map(Number);
  const [y2, m2] = targetMonth.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

/**
 * Adds integer months to a "YYYY-MM" string
 */
export function addMonths(baseMonth: string, monthsToAdd: number): string {
  const [y, m] = baseMonth.split('-').map(Number);
  const totalMonths = y * 12 + (m - 1) + monthsToAdd;
  const newY = Math.floor(totalMonths / 12);
  const newM = (totalMonths % 12) + 1;
  return `${newY}-${String(newM).padStart(2, '0')}`;
}

// ============================================================================
// 1. Customer Cohort Matrix Calculation
// ============================================================================

/**
 * Computes the full Partner Cohort Matrix including MRR retention, logo retention,
 * Net Revenue Retention (NRR), churn rate, realized LTV, and projected LTV.
 *
 * @param clients Array of client subscription records with history/orders
 * @returns Complete CohortMatrixResult
 */
export function computePartnerCohortMatrix(clients: ClientSubscriptionRecord[]): CohortMatrixResult {
  if (!clients || clients.length === 0) {
    return {
      cohorts: [],
      summary: {
        totalClients: 0,
        activeClients: 0,
        totalMrrCents: 0,
        avgLtvCents: 0,
        projectedLtvCents: 0,
        blendedChurnPct: 0,
        avgM1RetentionPct: 0,
        avgM3RetentionPct: 0,
        overallNrrPct: 100,
      },
    };
  }

  // 1. Normalize client records and group by Cohort Month
  interface NormalizedClient {
    clientId: string;
    cohortMonth: string;
    activityMap: Map<string, number>; // month -> mrrCents
    isCurrentlyActive: boolean;
    currentMrrCents: number;
    totalRevenueCents: number;
  }

  const normalizedClients: NormalizedClient[] = [];

  for (const client of clients) {
    const activityMap = new Map<string, number>();

    // Process explicit orders
    if (client.orders && client.orders.length > 0) {
      for (const order of client.orders) {
        const m = formatYearMonth(order.timestamp);
        const existing = activityMap.get(m) ?? 0;
        activityMap.set(m, existing + Math.max(0, order.mrrCents));
      }
    }

    // Process monthly history
    if (client.monthlyHistory && client.monthlyHistory.length > 0) {
      for (const hist of client.monthlyHistory) {
        const m = formatYearMonth(hist.month);
        const existing = activityMap.get(m) ?? 0;
        activityMap.set(m, Math.max(existing, Math.max(0, hist.mrrCents)));
      }
    }

    // Determine cohort month
    let cohortMonth: string;
    if (client.firstOrderAt) {
      cohortMonth = formatYearMonth(client.firstOrderAt);
    } else if (activityMap.size > 0) {
      const sortedMonths = Array.from(activityMap.keys()).sort();
      cohortMonth = sortedMonths[0];
    } else {
      cohortMonth = formatYearMonth(Date.now());
    }

    // If no explicit activity was provided in cohort month, use currentMrrCents
    const initialMrr = client.currentMrrCents ?? 0;
    if (!activityMap.has(cohortMonth) && initialMrr > 0) {
      activityMap.set(cohortMonth, initialMrr);
    }

    // Determine current activity status and MRR
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

    let totalRevenueCents = 0;
    for (const cents of activityMap.values()) {
      totalRevenueCents += cents;
    }

    normalizedClients.push({
      clientId: client.clientId,
      cohortMonth,
      activityMap,
      isCurrentlyActive,
      currentMrrCents,
      totalRevenueCents,
    });
  }

  // 2. Group by Cohort Month
  const cohortGroups = new Map<string, NormalizedClient[]>();
  for (const client of normalizedClients) {
    const list = cohortGroups.get(client.cohortMonth) ?? [];
    list.push(client);
    cohortGroups.set(client.cohortMonth, list);
  }

  const sortedCohortMonths = Array.from(cohortGroups.keys()).sort();
  const cohortRows: CohortRow[] = [];

  // Track metrics for summary aggregation
  let totalM1RetentionSum = 0;
  let m1CohortCount = 0;
  let totalM3RetentionSum = 0;
  let m3CohortCount = 0;
  let totalWeightedNrrSum = 0;
  let totalCohortMrrWeight = 0;

  for (const cMonth of sortedCohortMonths) {
    const cohortMembers = cohortGroups.get(cMonth) ?? [];
    const initialSize = cohortMembers.length;

    // Calculate initial MRR (Month 0 MRR)
    let initialMrrCents = 0;
    let cohortTotalRevenueCents = 0;

    for (const member of cohortMembers) {
      cohortTotalRevenueCents += member.totalRevenueCents;
      const m0Mrr = member.activityMap.get(cMonth) ?? member.currentMrrCents ?? 0;
      initialMrrCents += m0Mrr;
    }

    // Determine max month index observed for this cohort
    let maxMonthIndex = 0;
    for (const member of cohortMembers) {
      for (const actMonth of member.activityMap.keys()) {
        const diff = diffMonths(cMonth, actMonth);
        if (diff > maxMonthIndex) {
          maxMonthIndex = diff;
        }
      }
    }

    const periods: CohortPeriodMetric[] = [];

    for (let k = 0; k <= maxMonthIndex; k++) {
      const actMonth = addMonths(cMonth, k);
      let activeCount = 0;
      let monthMrrCents = 0;

      for (const member of cohortMembers) {
        if (k === 0) {
          // In Month 0, by definition all members in the cohort are initial clients
          const val = member.activityMap.get(actMonth) ?? member.currentMrrCents ?? 0;
          if (val > 0 || member.activityMap.has(actMonth) || member.isCurrentlyActive) {
            activeCount++;
          }
          monthMrrCents += val;
        } else {
          const val = member.activityMap.get(actMonth);
          if (val !== undefined && val > 0) {
            activeCount++;
            monthMrrCents += val;
          }
        }
      }

      // If k === 0 and activeCount was 0, default to initialSize
      if (k === 0 && activeCount === 0 && initialSize > 0) {
        activeCount = initialSize;
      }

      const logoRetentionPct = initialSize > 0
        ? Number(((activeCount / initialSize) * 100).toFixed(2))
        : 0;

      const logoChurnPct = Number((Math.max(0, 100 - logoRetentionPct)).toFixed(2));

      const nrrPct = initialMrrCents > 0
        ? Number(((monthMrrCents / initialMrrCents) * 100).toFixed(2))
        : (activeCount > 0 ? 100 : 0);

      const mrrChurnPct = Number((Math.max(0, 100 - nrrPct)).toFixed(2));

      periods.push({
        monthIndex: k,
        activityMonth: actMonth,
        activeClients: activeCount,
        logoRetentionPct,
        mrrCents: monthMrrCents,
        nrrPct,
        logoChurnPct,
        mrrChurnPct,
      });

      // Track M1 and M3
      if (k === 1) {
        totalM1RetentionSum += logoRetentionPct;
        m1CohortCount++;
      } else if (k === 3) {
        totalM3RetentionSum += logoRetentionPct;
        m3CohortCount++;
      }
    }

    // Weight NRR by initial cohort MRR
    const latestPeriod = periods[periods.length - 1];
    if (initialMrrCents > 0) {
      totalWeightedNrrSum += latestPeriod.nrrPct * initialMrrCents;
      totalCohortMrrWeight += initialMrrCents;
    }

    const realizedLtvCents = initialSize > 0
      ? Math.floor(cohortTotalRevenueCents / initialSize)
      : 0;

    cohortRows.push({
      cohortMonth: cMonth,
      initialSize,
      initialMrrCents,
      totalRealizedRevenueCents: cohortTotalRevenueCents,
      realizedLtvCents,
      periods,
    });
  }

  // 3. Compute Executive Summary
  const totalClients = normalizedClients.length;
  let activeClients = 0;
  let totalMrrCents = 0;
  let totalRevenueAllCents = 0;

  for (const client of normalizedClients) {
    if (client.isCurrentlyActive) {
      activeClients++;
      totalMrrCents += client.currentMrrCents;
    }
    totalRevenueAllCents += client.totalRevenueCents;
  }

  const avgLtvCents = totalClients > 0
    ? Math.floor(totalRevenueAllCents / totalClients)
    : 0;

  // Blended Churn Rate: (Total - Active) / Total * 100
  const churnedClients = Math.max(0, totalClients - activeClients);
  const blendedChurnPct = totalClients > 0
    ? Number(((churnedClients / totalClients) * 100).toFixed(2))
    : 0;

  // Projected LTV Model: (ARPU * GrossMarginPct) / MonthlyChurnRate
  // GrossMarginPct standard is 82% (0.82)
  const GROSS_MARGIN_PCT = 0.82;
  const arpuCents = activeClients > 0
    ? Math.floor(totalMrrCents / activeClients)
    : (totalClients > 0 ? Math.floor(totalMrrCents / totalClients) : 0);

  let projectedLtvCents = 0;
  if (blendedChurnPct > 0) {
    const monthlyChurnRateDecimal = blendedChurnPct / 100;
    projectedLtvCents = Math.floor((arpuCents * GROSS_MARGIN_PCT) / monthlyChurnRateDecimal);
  } else {
    // If churn is 0%, cap projected LTV at 36 months of ARPU at gross margin
    projectedLtvCents = Math.floor(arpuCents * GROSS_MARGIN_PCT * 36);
  }

  const avgM1RetentionPct = m1CohortCount > 0
    ? Number((totalM1RetentionSum / m1CohortCount).toFixed(2))
    : (totalClients > 0 ? 100 : 0);

  const avgM3RetentionPct = m3CohortCount > 0
    ? Number((totalM3RetentionSum / m3CohortCount).toFixed(2))
    : (avgM1RetentionPct > 0 ? avgM1RetentionPct : 0);

  const overallNrrPct = totalCohortMrrWeight > 0
    ? Number((totalWeightedNrrSum / totalCohortMrrWeight).toFixed(2))
    : 100;

  return {
    cohorts: cohortRows,
    summary: {
      totalClients,
      activeClients,
      totalMrrCents,
      avgLtvCents,
      projectedLtvCents,
      blendedChurnPct,
      avgM1RetentionPct,
      avgM3RetentionPct,
      overallNrrPct,
    },
  };
}

/**
 * Alias supporting both nomenclature conventions:
 * PROJECT.md (`computeCohortMatrix`) and DISPATCH.md (`computePartnerCohortMatrix`).
 */
export const computeCohortMatrix = computePartnerCohortMatrix;

// ============================================================================
// 2. Sub-Client MCU Consumption Velocity & Burn Runway
// ============================================================================

/**
 * Calculates rolling 7-day and 30-day MCU consumption velocity, acceleration,
 * and estimated runway days remaining.
 *
 * @param consumptionLogs Array of MCU consumption log records
 * @param windowDays Window size in days (defaults to 30)
 * @param currentBalance Current remaining MCU balance of the client/pool
 * @param referenceTimestamp Optional reference timestamp in ms (defaults to now or max log time)
 * @returns McuVelocityResult
 */
export function calculateMcuVelocity(
  consumptionLogs: McuLogRecord[],
  windowDays = 30,
  currentBalance = 0,
  referenceTimestamp?: number,
): McuVelocityResult {
  const safeBalance = Math.max(0, currentBalance);
  const safeWindowDays = Math.max(1, windowDays);

  if (!consumptionLogs || consumptionLogs.length === 0) {
    return {
      velocity7d: 0,
      velocity30d: 0,
      velocityWindowDays: 0,
      totalConsumedInWindow: 0,
      totalConsumedLifetime: 0,
      acceleration: 0,
      trend: 'stable',
      currentBalance: safeBalance,
      runwayDays: 999,
      exhaustionRisk: 'dormant',
    };
  }

  // Parse and extract consumption amounts and timestamps
  interface ParsedLog {
    timestamp: number;
    consumed: number;
  }

  const parsedLogs: ParsedLog[] = [];
  let maxLogTs = 0;
  let totalConsumedLifetime = 0;

  for (const log of consumptionLogs) {
    let ts = typeof log.timestamp === 'string'
      ? new Date(log.timestamp).getTime()
      : log.timestamp;

    if (Number.isNaN(ts)) {
      ts = Date.now();
    }

    if (ts > maxLogTs) {
      maxLogTs = ts;
    }

    // Delta is negative for consumption in mcu_transactions (e.g. -100)
    // Or positive if mcuConsumed is explicitly specified
    let consumed = 0;
    if (log.mcuConsumed !== undefined) {
      consumed = Math.max(0, log.mcuConsumed);
    } else if (log.delta !== undefined && log.delta < 0) {
      consumed = Math.abs(log.delta);
    } else if (log.delta !== undefined && log.delta > 0 && (log.reason?.toLowerCase().includes('consumption') || log.reason?.toLowerCase().includes('render'))) {
      consumed = log.delta;
    }

    totalConsumedLifetime += consumed;
    parsedLogs.push({ timestamp: ts, consumed });
  }

  // Anchor time: use explicit referenceTimestamp, or max log timestamp, or current time
  const anchorTime = referenceTimestamp ?? (maxLogTs > 0 ? maxLogTs : Date.now());

  const MS_PER_DAY = 86_400 * 1000;
  const cutoff7d = anchorTime - 7 * MS_PER_DAY;
  const cutoff30d = anchorTime - 30 * MS_PER_DAY;
  const cutoffWindow = anchorTime - safeWindowDays * MS_PER_DAY;

  let consumed7d = 0;
  let consumed30d = 0;
  let consumedWindow = 0;

  for (const p of parsedLogs) {
    const elapsedMs = anchorTime - p.timestamp;
    if (elapsedMs >= 0 && elapsedMs < 7 * MS_PER_DAY) {
      consumed7d += p.consumed;
    }
    if (elapsedMs >= 0 && elapsedMs < 30 * MS_PER_DAY) {
      consumed30d += p.consumed;
    }
    if (elapsedMs >= 0 && elapsedMs < safeWindowDays * MS_PER_DAY) {
      consumedWindow += p.consumed;
    }
  }

  const velocity7d = Number((consumed7d / 7.0).toFixed(2));
  const velocity30d = Number((consumed30d / 30.0).toFixed(2));
  const velocityWindowDays = Number((consumedWindow / safeWindowDays).toFixed(2));

  // Acceleration: a_mcu = (V_7d - V_30d) / (V_30d + epsilon)
  const EPSILON = 0.0001;
  const rawAcceleration = (velocity7d - velocity30d) / (velocity30d + EPSILON);
  const acceleration = Number(rawAcceleration.toFixed(3));

  let trend: 'accelerating' | 'decelerating' | 'stable' = 'stable';
  if (acceleration > 0.25) {
    trend = 'accelerating';
  } else if (acceleration < -0.25) {
    trend = 'decelerating';
  }

  // Runway Days: Math.floor(currentBalance / V_7d)
  let runwayDays = 999;
  if (velocity7d > 0) {
    runwayDays = Math.floor(safeBalance / velocity7d);
  } else if (velocity30d > 0) {
    runwayDays = Math.floor(safeBalance / velocity30d);
  }

  // Exhaustion Risk Status
  let exhaustionRisk: 'imminent' | 'warning' | 'healthy' | 'dormant' = 'healthy';
  if (velocity7d === 0 && velocity30d === 0) {
    exhaustionRisk = 'dormant';
  } else if (runwayDays < 7) {
    exhaustionRisk = 'imminent';
  } else if (runwayDays < 15) {
    exhaustionRisk = 'warning';
  } else {
    exhaustionRisk = 'healthy';
  }

  return {
    velocity7d,
    velocity30d,
    velocityWindowDays,
    totalConsumedInWindow: consumedWindow,
    totalConsumedLifetime,
    acceleration,
    trend,
    currentBalance: safeBalance,
    runwayDays,
    exhaustionRisk,
  };
}

// ============================================================================
// 3. Partner Analytics Summary from D1 Database
// ============================================================================

/**
 * Aggregates client metrics, top sub-clients, and revenue growth for a partner.
 *
 * @param db D1Database client instance
 * @param partnerId ID of the partner
 * @returns Complete PartnerAnalyticsSummary
 */
export async function getPartnerAnalyticsSummary(
  db: D1Database,
  partnerId: string,
): Promise<PartnerAnalyticsSummary> {
  const currentPeriod = formatYearMonth(Date.now());
  const now = Date.now();

  // 1. Fetch Partner Profile
  interface ProfileRow {
    id: string;
    partner_name: string;
    tier: PartnerTier;
    total_referred_customers: number;
    total_mrr_cents: number;
    total_earnings_cents: number;
    pending_payout_cents: number;
  }

  let profile: ProfileRow | null | undefined;
  try {
    profile = await db
      .prepare(
        `SELECT id, partner_name, tier, total_referred_customers, total_mrr_cents,
                total_earnings_cents, pending_payout_cents
         FROM partner_profiles
         WHERE id = ?1`
      )
      .bind(partnerId)
      .first<ProfileRow>();
  } catch {
    profile = undefined;
  }

  const partnerName = profile?.partner_name ?? 'Partner';
  const tier: PartnerTier = profile?.tier ?? 'SILVER';

  // 2. Fetch Commissions & Sub-Client Order History
  interface CommissionRow {
    referred_user_id: string;
    order_id: string;
    mrr_cents: number;
    commission_cents: number;
    created_at: number;
  }

  let commissions: CommissionRow[] = [];
  try {
    const res = await db
      .prepare(
        `SELECT referred_user_id, order_id, mrr_cents, commission_cents, created_at
         FROM partner_commissions
         WHERE partner_id = ?1 AND status IN ('pending', 'approved', 'paid')
         ORDER BY created_at ASC`
      )
      .bind(partnerId)
      .all<CommissionRow>();
    commissions = res.results || [];
  } catch {
    commissions = [];
  }

  // 3. Group by Client to build ClientSubscriptionRecords and SubClientMetrics
  const clientMap = new Map<string, {
    clientId: string;
    orders: ClientOrderRecord[];
    firstSeenAt: number;
    lastActiveAt: number;
    lifetimeMrrCents: number;
    lifetimeCommissionCents: number;
    currentMrrCents: number;
  }>();

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

  // 4. Fetch License Pools / MCU stats if available
  interface PoolRow {
    total_mcu_credits: number;
    allocated_mcu_credits: number;
    consumed_mcu_credits: number;
  }

  let poolStats: PoolRow | null | undefined;
  try {
    poolStats = await db
      .prepare(
        `SELECT SUM(total_mcu_credits) as total_mcu_credits,
                SUM(allocated_mcu_credits) as allocated_mcu_credits,
                SUM(consumed_mcu_credits) as consumed_mcu_credits
         FROM partner_license_pools
         WHERE partner_id = ?1 AND status = 'active'`
      )
      .bind(partnerId)
      .first<PoolRow>();
  } catch {
    poolStats = undefined;
  }

  const totalMcuAllocated = Number(poolStats?.allocated_mcu_credits ?? 0);
  const totalMcuConsumed = Number(poolStats?.consumed_mcu_credits ?? 0);

  // 5. Convert to ClientSubscriptionRecords and SubClientMetrics
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

    // Approximate daily velocity based on lifetime MRR or consumption
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

  // 6. Compute Cohort Matrix
  const cohortMatrix = computePartnerCohortMatrix(subscriptionRecords);

  // Sort sub-clients by current MRR descending
  subClientMetrics.sort((a, b) => b.currentMrrCents - a.currentMrrCents);
  const topSubClients = subClientMetrics.slice(0, 10);

  // 7. Calculate Revenue Growth Percentage
  let revenueGrowthPct = 0;
  if (cohortMatrix.cohorts.length >= 2) {
    const firstCohortMrr = cohortMatrix.cohorts[0].initialMrrCents;
    const latestCohortMrr = cohortMatrix.cohorts[cohortMatrix.cohorts.length - 1].initialMrrCents;
    if (firstCohortMrr > 0) {
      revenueGrowthPct = Number((((latestCohortMrr - firstCohortMrr) / firstCohortMrr) * 100).toFixed(1));
    }
  }

  // Monthly commission cents: sum of commissions created in the current period
  const startOfMonth = new Date(currentPeriod + '-01T00:00:00Z').getTime();
  let monthlyCommissionCents = 0;
  let totalMrrCents = 0;

  for (const c of commissions) {
    if (c.created_at >= startOfMonth) {
      monthlyCommissionCents += c.commission_cents;
    }
    totalMrrCents += c.mrr_cents;
  }

  if (profile?.total_mrr_cents && profile.total_mrr_cents > 0) {
    totalMrrCents = profile.total_mrr_cents;
  }

  const avgMcuVelocityDaily = subClientMetrics.length > 0
    ? Number((subClientMetrics.reduce((acc, c) => acc + c.mcuVelocityDaily, 0) / subClientMetrics.length).toFixed(1))
    : 0;

  return {
    partnerId,
    partnerName,
    tier,
    period: currentPeriod,
    generatedAt: now,
    totalSubClients: cohortMatrix.summary.totalClients,
    activeSubClients: cohortMatrix.summary.activeClients,
    totalMrrCents,
    monthlyCommissionCents,
    lifetimeEarningsCents: profile?.total_earnings_cents ?? 0,
    totalMcuAllocated,
    totalMcuConsumed,
    avgMcuVelocityDaily,
    avgLtvCents: cohortMatrix.summary.avgLtvCents,
    blendedChurnPct: cohortMatrix.summary.blendedChurnPct,
    revenueGrowthPct,
    topSubClients,
    cohortMatrix,
  };
}
