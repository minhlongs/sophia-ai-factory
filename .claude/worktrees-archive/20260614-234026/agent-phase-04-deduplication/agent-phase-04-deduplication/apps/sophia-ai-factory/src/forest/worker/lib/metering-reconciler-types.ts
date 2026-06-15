import type { ReconciliationConfig } from '@/seed/types/billing-contracts';

export interface AggregatedUsage {
  licenseNonce: string;
  userId: string;
  service: string;
  totalCredits: number;
  eventCount: number;
  periodStart: number;
  periodEnd: number;
}

export interface LicenseValidationResult {
  valid: boolean;
  tier?: string;
  status?: string;
  error?: string;
}

export const CRON_RECONCILIATION_CONFIG: ReconciliationConfig = {
  timeRangeHours: 24,
  eventBatchSize: 100,
  kvBatchSize: 100,
  maxRetries: 3,
  retryDelayMs: 1000,
  r2KeyPrefix: 'reports/reconciliation-',
  retentionDays: 90,
  emitAlerts: true,
};
