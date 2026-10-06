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
  currentActiveSize?: number;
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
  totalCohortsTracked?: number;
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
// Helper: Normalize a single client subscription record
interface NormalizedClient {
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

function normalizeSingleClient(client: ClientSubscriptionRecord): NormalizedClient {
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

function groupClientsByCohortMonth(clients: NormalizedClient[]): Map<string, NormalizedClient[]> {
  const cohortGroups = new Map<string, NormalizedClient[]>();
  for (const client of clients) {
    const list = cohortGroups.get(client.cohortMonth) ?? [];
    list.push(client);
    cohortGroups.set(client.cohortMonth, list);
  }
  return cohortGroups;
}

function countPeriodActivity(
  k: number,
  actMonth: string,
  cohortMembers: NormalizedClient[],
  initialSize: number,
): { activeCount: number; monthMrrCents: number } {
  let activeCount = 0;
  let monthMrrCents = 0;

  for (const member of cohortMembers) {
    if (k === 0) {
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

  if (k === 0 && activeCount === 0 && initialSize > 0) {
    activeCount = initialSize;
  }

  return { activeCount, monthMrrCents };
}

function calculateCohortPeriodMetric(
  k: number,
  actMonth: string,
  cohortMembers: NormalizedClient[],
  initialSize: number,
  initialMrrCents: number,
): CohortPeriodMetric {
  const { activeCount, monthMrrCents } = countPeriodActivity(k, actMonth, cohortMembers, initialSize);

  const logoRetentionPct = initialSize > 0
    ? Number(((activeCount / initialSize) * 100).toFixed(2))
    : 0;

  const logoChurnPct = Number((Math.max(0, 100 - logoRetentionPct)).toFixed(2));

  const nrrPct = initialMrrCents > 0
    ? Number(((monthMrrCents / initialMrrCents) * 100).toFixed(2))
    : (activeCount > 0 ? 100 : 0);

  const mrrChurnPct = Number((Math.max(0, 100 - nrrPct)).toFixed(2));

  return {
    monthIndex: k,
    activityMonth: actMonth,
    activeClients: activeCount,
    logoRetentionPct,
    mrrCents: monthMrrCents,
    nrrPct,
    logoChurnPct,
    mrrChurnPct,
  };
}

function buildCohortRow(
  cMonth: string,
  cohortMembers: NormalizedClient[],
): { row: CohortRow; m1?: number; m3?: number } {
  const initialSize = cohortMembers.length;
  let initialMrrCents = 0;
  let cohortTotalRevenueCents = 0;
  let maxMonthIndex = 0;

  for (const member of cohortMembers) {
    cohortTotalRevenueCents += member.totalRevenueCents;
    const m0Mrr = member.activityMap.get(cMonth) ?? member.currentMrrCents ?? 0;
    initialMrrCents += m0Mrr;
    for (const actMonth of member.activityMap.keys()) {
      const diff = diffMonths(cMonth, actMonth);
      if (diff > maxMonthIndex) {
        maxMonthIndex = diff;
      }
    }
  }

  const periods: CohortPeriodMetric[] = [];
  let m1: number | undefined;
  let m3: number | undefined;

  for (let k = 0; k <= maxMonthIndex; k++) {
    const actMonth = addMonths(cMonth, k);
    const metric = calculateCohortPeriodMetric(k, actMonth, cohortMembers, initialSize, initialMrrCents);
    periods.push(metric);
    if (k === 1) m1 = metric.logoRetentionPct;
    if (k === 3) m3 = metric.logoRetentionPct;
  }

  const realizedLtvCents = initialSize > 0
    ? Math.floor(cohortTotalRevenueCents / initialSize)
    : 0;

  const latestPeriod = periods[periods.length - 1];
  const currentActiveSize = latestPeriod ? latestPeriod.activeClients : initialSize;

  return {
    row: {
      cohortMonth: cMonth,
      initialSize,
      initialMrrCents,
      totalRealizedRevenueCents: cohortTotalRevenueCents,
      realizedLtvCents,
      periods,
      currentActiveSize,
    },
    m1,
    m3,
  };
}

function calculateProjectedLtv(arpuCents: number, blendedChurnPct: number): number {
  const GROSS_MARGIN_PCT = 0.82;
  if (blendedChurnPct > 0) {
    const monthlyChurnRateDecimal = blendedChurnPct / 100;
    return Math.floor((arpuCents * GROSS_MARGIN_PCT) / monthlyChurnRateDecimal);
  }
  return Math.floor(arpuCents * GROSS_MARGIN_PCT * 36);
}

function computeCohortSummary(
  normalizedClients: NormalizedClient[],
  cohortRows: CohortRow[],
  m1Sum: number,
  m1Count: number,
  m3Sum: number,
  m3Count: number,
  weightedNrrSum: number,
  cohortMrrWeight: number,
): CohortSummary {
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

  const churnedClients = Math.max(0, totalClients - activeClients);
  const blendedChurnPct = totalClients > 0
    ? Number(((churnedClients / totalClients) * 100).toFixed(2))
    : 0;

  const arpuCents = activeClients > 0
    ? Math.floor(totalMrrCents / activeClients)
    : (totalClients > 0 ? Math.floor(totalMrrCents / totalClients) : 0);

  const projectedLtvCents = calculateProjectedLtv(arpuCents, blendedChurnPct);

  const avgM1RetentionPct = m1Count > 0
    ? Number((m1Sum / m1Count).toFixed(2))
    : (totalClients > 0 ? 100 : 0);

  const avgM3RetentionPct = m3Count > 0
    ? Number((m3Sum / m3Count).toFixed(2))
    : (avgM1RetentionPct > 0 ? avgM1RetentionPct : 0);

  const overallNrrPct = cohortMrrWeight > 0
    ? Number((weightedNrrSum / cohortMrrWeight).toFixed(2))
    : 100;

  return {
    totalClients,
    activeClients,
    totalMrrCents,
    avgLtvCents,
    projectedLtvCents,
    blendedChurnPct,
    avgM1RetentionPct,
    avgM3RetentionPct,
    overallNrrPct,
    totalCohortsTracked: cohortRows.length,
  };
}

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
        totalCohortsTracked: 0,
      },
    };
  }

  const normalizedClients = clients.map(normalizeSingleClient);
  const cohortGroups = groupClientsByCohortMonth(normalizedClients);
  const sortedCohortMonths = Array.from(cohortGroups.keys()).sort();

  const cohortRows: CohortRow[] = [];
  let totalM1RetentionSum = 0;
  let m1CohortCount = 0;
  let totalM3RetentionSum = 0;
  let m3CohortCount = 0;
  let totalWeightedNrrSum = 0;
  let totalCohortMrrWeight = 0;

  for (const cMonth of sortedCohortMonths) {
    const cohortMembers = cohortGroups.get(cMonth) ?? [];
    const { row, m1, m3 } = buildCohortRow(cMonth, cohortMembers);
    cohortRows.push(row);

    if (m1 !== undefined) {
      totalM1RetentionSum += m1;
      m1CohortCount++;
    }
    if (m3 !== undefined) {
      totalM3RetentionSum += m3;
      m3CohortCount++;
    }

    if (row.initialMrrCents > 0) {
      const latestPeriod = row.periods[row.periods.length - 1];
      totalWeightedNrrSum += latestPeriod.nrrPct * row.initialMrrCents;
      totalCohortMrrWeight += row.initialMrrCents;
    }
  }

  const summary = computeCohortSummary(
    normalizedClients,
    cohortRows,
    totalM1RetentionSum,
    m1CohortCount,
    totalM3RetentionSum,
    m3CohortCount,
    totalWeightedNrrSum,
    totalCohortMrrWeight,
  );

  return {
    cohorts: cohortRows,
    summary,
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

interface ParsedLog {
  timestamp: number;
  consumed: number;
}

function parseMcuLogRecord(log: McuLogRecord): { ts: number; consumed: number } {
  let ts = typeof log.timestamp === 'string'
    ? new Date(log.timestamp).getTime()
    : log.timestamp;

  if (Number.isNaN(ts)) {
    ts = Date.now();
  }

  let consumed = 0;
  if (log.mcuConsumed !== undefined) {
    consumed = Math.max(0, log.mcuConsumed);
  } else if (log.delta !== undefined && log.delta < 0) {
    consumed = Math.abs(log.delta);
  } else if (log.delta !== undefined && log.delta > 0 && (log.reason?.toLowerCase().includes('consumption') || log.reason?.toLowerCase().includes('render'))) {
    consumed = log.delta;
  }

  return { ts, consumed };
}

function parseMcuLogs(consumptionLogs: McuLogRecord[]): {
  parsedLogs: ParsedLog[];
  maxLogTs: number;
  totalConsumedLifetime: number;
} {
  const parsedLogs: ParsedLog[] = [];
  let maxLogTs = 0;
  let totalConsumedLifetime = 0;

  for (const log of consumptionLogs) {
    const { ts, consumed } = parseMcuLogRecord(log);
    if (ts > maxLogTs) {
      maxLogTs = ts;
    }
    totalConsumedLifetime += consumed;
    parsedLogs.push({ timestamp: ts, consumed });
  }

  return { parsedLogs, maxLogTs, totalConsumedLifetime };
}

function calculateConsumptionWindows(
  parsedLogs: ParsedLog[],
  anchorTime: number,
  safeWindowDays: number,
): { consumed7d: number; consumed30d: number; consumedWindow: number } {
  const MS_PER_DAY = 86_400 * 1000;
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

  return { consumed7d, consumed30d, consumedWindow };
}

function determineRunwayAndRisk(
  velocity7d: number,
  velocity30d: number,
  safeBalance: number,
): { runwayDays: number; exhaustionRisk: 'imminent' | 'warning' | 'healthy' | 'dormant' } {
  let runwayDays = 999;
  if (velocity7d > 0) {
    runwayDays = Math.floor(safeBalance / velocity7d);
  } else if (velocity30d > 0) {
    runwayDays = Math.floor(safeBalance / velocity30d);
  }

  let exhaustionRisk: 'imminent' | 'warning' | 'healthy' | 'dormant' = 'healthy';
  if (velocity7d === 0 && velocity30d === 0) {
    exhaustionRisk = 'dormant';
  } else if (runwayDays < 7) {
    exhaustionRisk = 'imminent';
  } else if (runwayDays < 15) {
    exhaustionRisk = 'warning';
  }

  return { runwayDays, exhaustionRisk };
}

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

  const { parsedLogs, maxLogTs, totalConsumedLifetime } = parseMcuLogs(consumptionLogs);
  const anchorTime = referenceTimestamp ?? (maxLogTs > 0 ? maxLogTs : Date.now());
  const { consumed7d, consumed30d, consumedWindow } = calculateConsumptionWindows(parsedLogs, anchorTime, safeWindowDays);

  const velocity7d = Number((consumed7d / 7.0).toFixed(2));
  const velocity30d = Number((consumed30d / 30.0).toFixed(2));
  const velocityWindowDays = Number((consumedWindow / safeWindowDays).toFixed(2));

  const EPSILON = 0.0001;
  const rawAcceleration = (velocity7d - velocity30d) / (velocity30d + EPSILON);
  const acceleration = Number(rawAcceleration.toFixed(3));

  let trend: 'accelerating' | 'decelerating' | 'stable' = 'stable';
  if (acceleration > 0.25) {
    trend = 'accelerating';
  } else if (acceleration < -0.25) {
    trend = 'decelerating';
  }

  const { runwayDays, exhaustionRisk } = determineRunwayAndRisk(velocity7d, velocity30d, safeBalance);

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
interface ProfileRow {
  id: string;
  partner_name: string;
  tier: PartnerTier;
  total_referred_customers: number;
  total_mrr_cents: number;
  total_earnings_cents: number;
  pending_payout_cents: number;
}

interface CommissionRow {
  referred_user_id: string;
  order_id: string;
  mrr_cents: number;
  commission_cents: number;
  created_at: number;
}

interface PoolRow {
  total_mcu_credits: number;
  allocated_mcu_credits: number;
  consumed_mcu_credits: number;
}

interface ClientGroupData {
  clientId: string;
  orders: ClientOrderRecord[];
  firstSeenAt: number;
  lastActiveAt: number;
  lifetimeMrrCents: number;
  lifetimeCommissionCents: number;
  currentMrrCents: number;
}

async function fetchPartnerProfile(db: D1Database, partnerId: string): Promise<ProfileRow | undefined> {
  try {
    const res = await db
      .prepare(
        `SELECT id, partner_name, tier, total_referred_customers, total_mrr_cents,
                total_earnings_cents, pending_payout_cents
         FROM partner_profiles
         WHERE id = ?1`
      )
      .bind(partnerId)
      .first<ProfileRow>();
    return res ?? undefined;
  } catch {
    return undefined;
  }
}

async function fetchPartnerCommissions(db: D1Database, partnerId: string): Promise<CommissionRow[]> {
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
    return res.results || [];
  } catch {
    return [];
  }
}

async function fetchPartnerPoolStats(db: D1Database, partnerId: string): Promise<PoolRow | undefined> {
  try {
    const res = await db
      .prepare(
        `SELECT SUM(total_mcu_credits) as total_mcu_credits,
                SUM(allocated_mcu_credits) as allocated_mcu_credits,
                SUM(consumed_mcu_credits) as consumed_mcu_credits
         FROM partner_license_pools
         WHERE partner_id = ?1 AND status = 'active'`
      )
      .bind(partnerId)
      .first<PoolRow>();
    return res ?? undefined;
  } catch {
    return undefined;
  }
}

function groupCommissionsByClient(commissions: CommissionRow[]): Map<string, ClientGroupData> {
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

function buildSubClientMetrics(
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

function calculateRevenueGrowthPct(cohorts: CohortRow[]): number {
  if (cohorts.length >= 2) {
    const firstCohortMrr = cohorts[0].initialMrrCents;
    const latestCohortMrr = cohorts[cohorts.length - 1].initialMrrCents;
    if (firstCohortMrr > 0) {
      return Number((((latestCohortMrr - firstCohortMrr) / firstCohortMrr) * 100).toFixed(1));
    }
  }
  return 0;
}

function calculateCommissionsAndMrr(
  commissions: CommissionRow[],
  currentPeriod: string,
  profileMrr?: number,
): { monthlyCommissionCents: number; totalMrrCents: number } {
  const startOfMonth = new Date(currentPeriod + '-01T00:00:00Z').getTime();
  let monthlyCommissionCents = 0;
  let totalMrrCents = 0;

  for (const c of commissions) {
    if (c.created_at >= startOfMonth) {
      monthlyCommissionCents += c.commission_cents;
    }
    totalMrrCents += c.mrr_cents;
  }

  if (profileMrr && profileMrr > 0) {
    totalMrrCents = profileMrr;
  }

  return { monthlyCommissionCents, totalMrrCents };
}

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

  const [profile, commissions, poolStats] = await Promise.all([
    fetchPartnerProfile(db, partnerId),
    fetchPartnerCommissions(db, partnerId),
    fetchPartnerPoolStats(db, partnerId),
  ]);

  const partnerName = profile?.partner_name ?? 'Partner';
  const tier: PartnerTier = profile?.tier ?? 'SILVER';
  const totalMcuAllocated = Number(poolStats?.allocated_mcu_credits ?? 0);
  const totalMcuConsumed = Number(poolStats?.consumed_mcu_credits ?? 0);

  const clientMap = groupCommissionsByClient(commissions);
  const { subscriptionRecords, subClientMetrics } = buildSubClientMetrics(clientMap, now);

  const cohortMatrix = computePartnerCohortMatrix(subscriptionRecords);

  subClientMetrics.sort((a, b) => b.currentMrrCents - a.currentMrrCents);
  const topSubClients = subClientMetrics.slice(0, 10);

  const revenueGrowthPct = calculateRevenueGrowthPct(cohortMatrix.cohorts);
  const { monthlyCommissionCents, totalMrrCents } = calculateCommissionsAndMrr(
    commissions,
    currentPeriod,
    profile?.total_mrr_cents,
  );

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
