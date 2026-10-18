/**
 * Usage Summary Builders (Hourly & Daily Rollups)
 *
 * Pure in-memory rollup helpers for aggregated usage events.
 *
 * @module usage-metering/usage-summary-builders
 */

import type {
  AggregatedUsage,
  HourlySummary,
  DailySummary,
} from './types';

/**
 * Build hourly summary from aggregated events.
 */
export function buildHourlySummary(aggregatedEvents: AggregatedUsage[]): HourlySummary[] {
  const hourlyMap = new Map<number, HourlySummary>();

  for (const event of aggregatedEvents) {
    const hourTs = event.timestamp;
    const existing = hourlyMap.get(hourTs) || {
      hourTimestamp: hourTs,
      serviceBreakdown: [],
      totalCredits: 0,
      totalRequests: 0,
      totalTokens: 0,
    };

    const existingService = existing.serviceBreakdown.find(
      (s) => s.featureKey === event.featureKey && s.licenseNonce === event.licenseNonce,
    );

    if (existingService) {
      existingService.consumedUnits += event.consumedUnits;
      existingService.requestCount += event.requestCount;
      existingService.tokensInput += event.tokensInput;
      existingService.tokensOutput += event.tokensOutput;
    } else {
      existing.serviceBreakdown.push({ ...event });
    }

    existing.totalCredits += event.consumedUnits;
    existing.totalRequests += event.requestCount;
    existing.totalTokens += event.tokensInput + event.tokensOutput;

    hourlyMap.set(hourTs, existing);
  }

  return Array.from(hourlyMap.values()).sort((a, b) => a.hourTimestamp - b.hourTimestamp);
}

/**
 * Build daily summary from hourly summaries.
 */
export function buildDailySummary(hourlySummaries: HourlySummary[]): DailySummary[] {
  const dailyMap = new Map<number, DailySummary>();

  for (const hourly of hourlySummaries) {
    const dayTs = Math.floor(hourly.hourTimestamp / 86400) * 86400;
    const existing = dailyMap.get(dayTs) || {
      dayTimestamp: dayTs,
      hourlyBreakdown: [],
      totalCredits: 0,
      totalRequests: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
    };

    existing.hourlyBreakdown.push(hourly);
    existing.totalCredits += hourly.totalCredits;
    existing.totalRequests += hourly.totalRequests;

    for (const service of hourly.serviceBreakdown) {
      existing.totalTokensInput += service.tokensInput;
      existing.totalTokensOutput += service.tokensOutput;
    }

    dailyMap.set(dayTs, existing);
  }

  return Array.from(dailyMap.values()).sort((a, b) => a.dayTimestamp - b.dayTimestamp);
}
