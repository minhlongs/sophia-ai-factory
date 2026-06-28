/** Usage summary for a period */
export interface UsageSummary {
  service_name: string;
  total_requests: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_credits: number;
}

/** Daily usage breakdown */
export interface DailyUsage {
  day_timestamp: number;
  service_name: string;
  requests: number;
  credits: number;
}

/** Aggregated usage by time window */
export interface AggregatedUsage {
  tenantId: string;         // user_id
  licenseNonce: string;     // license identifier
  featureKey: string;       // service_name + action (e.g., "heygen.createVideo")
  timestamp: number;        // Unix timestamp (hour or day boundary)
  consumedUnits: number;    // credits used
  requestCount: number;     // total API calls
  tokensInput: number;      // total input tokens
  tokensOutput: number;     // total output tokens
  avgResponseTimeMs: number; // average response time
  errorCount: number;       // failed requests
}

/** Hourly summary aggregation */
export interface HourlySummary {
  hourTimestamp: number;    // Start of hour (Unix timestamp)
  serviceBreakdown: AggregatedUsage[];
  totalCredits: number;
  totalRequests: number;
  totalTokens: number;
}

/** Daily summary aggregation */
export interface DailySummary {
  dayTimestamp: number;     // Start of day (Unix timestamp)
  hourlyBreakdown: HourlySummary[];
  totalCredits: number;
  totalRequests: number;
  totalTokensInput: number;
  totalTokensOutput: number;
}
