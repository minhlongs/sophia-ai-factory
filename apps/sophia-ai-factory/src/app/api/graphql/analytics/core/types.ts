export interface GraphQLExecutionResult {
  data?: unknown;
  errors?: Array<{ message: string }>;
}

export interface GraphQLQueryRequest {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export type AnalyticsUsageGranularity = 'hour' | 'day';

export type AnalyticsRevenuePeriod =
  | 'current_month'
  | 'last_month'
  | 'last_7_days'
  | 'last_30_days';

export type AnalyticsLicenseStatus = 'active' | 'expired' | 'revoked' | 'all';
