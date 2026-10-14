export interface SLOConfig {
  name: string;
  targetValue: number;
  targetOperator: 'gte' | 'lte';
  routes: string[];
  thresholdMs?: number;
}

export type SLOAlertLevel = 'info' | 'warning' | 'critical' | 'emergency' | null;

export interface SLOBurnMetrics {
  totalRequests: number;
  goodRequests: number;
  badRequests: number;
  measuredValue: number;
  errorBudget: number;
  errorBudgetConsumed: number;
  burnRate: number;
  alertLevel: SLOAlertLevel;
  p50: number;
  p95: number;
  p99: number;
}

export interface SLOCronItemResult {
  slo: string;
  burnRate?: number;
  alertLevel?: SLOAlertLevel;
  totalRequests?: number;
  error?: string;
}

export interface SLOCronResponse {
  success: boolean;
  yearMonth: string;
  windowStart: string;
  windowEnd: string;
  results: SLOCronItemResult[];
}
