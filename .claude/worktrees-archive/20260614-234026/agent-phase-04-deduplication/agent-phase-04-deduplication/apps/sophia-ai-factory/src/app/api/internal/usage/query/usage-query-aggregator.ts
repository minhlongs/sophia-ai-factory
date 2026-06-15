import type { HourlySummary, DailySummary } from '@/forest/usage-metering/types';

interface RawUsageEvent {
  user_id: string;
  license_nonce: string;
  service_name: string;
  action: string;
  credits_used: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  response_time_ms: number | null;
  status_code: number | null;
  created_at: number;
}

/** Build hourly aggregation from raw usage events. */
export function buildHourlyAggregation(events: RawUsageEvent[]): HourlySummary[] {
  const hourlyMap = new Map<number, HourlySummary>();

  for (const event of events) {
    const hourTs = Math.floor(event.created_at / 3600) * 3600;

    const hourly = hourlyMap.get(hourTs) || {
      hourTimestamp: hourTs,
      serviceBreakdown: [],
      totalCredits: 0,
      totalRequests: 0,
      totalTokens: 0,
    };

    const featureKey = `${event.service_name}.${event.action}`;

    let service = hourly.serviceBreakdown.find(s => s.featureKey === featureKey);
    if (!service) {
      service = {
        tenantId: event.user_id,
        licenseNonce: event.license_nonce,
        featureKey,
        timestamp: hourTs,
        consumedUnits: 0,
        requestCount: 0,
        tokensInput: 0,
        tokensOutput: 0,
        avgResponseTimeMs: 0,
        errorCount: 0,
      };
      hourly.serviceBreakdown.push(service);
    }

    service.consumedUnits += event.credits_used || 0;
    service.requestCount += 1;
    service.tokensInput += event.tokens_input || 0;
    service.tokensOutput += event.tokens_output || 0;

    if (event.response_time_ms) {
      service.avgResponseTimeMs =
        ((service.avgResponseTimeMs * (service.requestCount - 1)) + event.response_time_ms) /
        service.requestCount;
    }

    if (!event.status_code || event.status_code >= 400) {
      service.errorCount += 1;
    }

    hourly.totalCredits += event.credits_used || 0;
    hourly.totalRequests += 1;
    hourly.totalTokens += (event.tokens_input || 0) + (event.tokens_output || 0);

    hourlyMap.set(hourTs, hourly);
  }

  return Array.from(hourlyMap.values()).sort((a, b) => a.hourTimestamp - b.hourTimestamp);
}

/** Aggregate hourly summaries into daily summaries. */
export function buildDailyFromHourly(hourly: HourlySummary[]): DailySummary[] {
  const dailyMap = new Map<number, DailySummary>();

  for (const hour of hourly) {
    const dayTs = Math.floor(hour.hourTimestamp / 86400) * 86400;

    const daily = dailyMap.get(dayTs) || {
      dayTimestamp: dayTs,
      hourlyBreakdown: [],
      totalCredits: 0,
      totalRequests: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
    };

    daily.hourlyBreakdown.push(hour);
    daily.totalCredits += hour.totalCredits;
    daily.totalRequests += hour.totalRequests;

    for (const service of hour.serviceBreakdown) {
      daily.totalTokensInput += service.tokensInput;
      daily.totalTokensOutput += service.tokensOutput;
    }

    dailyMap.set(dayTs, daily);
  }

  return Array.from(dailyMap.values()).sort((a, b) => a.dayTimestamp - b.dayTimestamp);
}
