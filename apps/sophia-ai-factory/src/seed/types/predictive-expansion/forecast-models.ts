import type { Tier } from '@/seed/types';

export interface MonthlyForecastSlice {
  id: string;
  forecastBatchId: string;
  forecastPeriodMonth: string;
  horizonMonthOffset: number; // 1 to 12
  baselineMrrCents: number;
  p10PessimisticMrrCents: number;
  p50ExpectedMrrCents: number;
  p90OptimisticMrrCents: number;
  p99BullCaseMrrCents: number;
  simulatedIterations: number;
  expectedActiveCustomers: number;
  expectedArpuCents: number;
  projectedNrrPct: number;
  projectedGrrPct: number;
  projectedChurnRatePct: number;
  projectedExpansionRatePct: number;
  targetMrrCents: number;
  targetCustomers: number;
  targetArpuCents: number;
  probabilityAchievingTarget: number;
  assumptions: Record<string, unknown>;
  isApprovedForBoard: boolean;
  approvedBy: string | null;
  approvedAt: number | null;
  createdAt: number;
}

export interface InvestorRelationsForecastReport {
  batchId: string;
  generatedAt: number;
  slices: MonthlyForecastSlice[];
  targetAchievedInP50: boolean;
  overallTargetProbability: number;
  summary: {
    startingMrrCents: number;
    endingP50MrrCents: number;
    endingP90MrrCents: number;
    projectedAvgNrrPct: number;
  };
}

export interface CustomerTelemetryFeatures {
  customerId: string;
  orgId?: string | null;
  currentTier: Tier;
  tenureDays: number;
  currentMrrCents: number;
  usedMcuMonthly: number;
  quotaMcuMonthly: number;
  videoGenerationsLast7d: number;
  videoGenerationsPrev30d: number;
  activeLoginsLast14d: number;
  apiRequestsCount: number;
  apiErrorsCount: number;
  activeAgentsCount: number;
  featuresUsedCount: number;
}

export interface MonteCarloSimulationInput {
  startingMrrCents: number;
  startingCustomersCount: number;
  iterations?: number; // default: 10,000
  horizonMonths?: number; // default: 12
  meanMonthlyChurnPct?: number; // default: 1.0% (0.010)
  stdDevMonthlyChurnPct?: number; // default: 0.3% (0.003)
  meanMonthlyExpansionPct?: number; // default: 3.5% (0.035)
  stdDevMonthlyExpansionPct?: number; // default: 0.8% (0.008)
  meanMonthlyNewCustomers?: number; // default: 450
  stdDevMonthlyNewCustomers?: number; // default: 50
  newCustomerArpuCents?: number; // default: 22,000 cents ($220)
  batchId?: string;
  randomSeed?: number; // for deterministic testing
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
