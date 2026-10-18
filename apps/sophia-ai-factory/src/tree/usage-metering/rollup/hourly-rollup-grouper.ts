/**
 * Hourly Rollup Grouping Helper
 *
 * Layer: tree/usage-metering/rollup
 */

import type { HourlySummaryRecord, ServiceBreakdownItem } from './rollup-utils';
import { calcAvgResponseTime } from './rollup-utils';

export interface HourlyGroupRow {
  user_id: string;
  license_nonce: string;
  external_customer_id: string | null;
  service_name: string;
  total_requests: number;
  total_credits: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_errors: number;
  avg_response_time_ms: number | null;
}

/**
 * Groups SQL-aggregated hourly rows by tenant + license into HourlySummaryRecord[].
 */
export function buildHourlySummariesFromRows(
  groupedRows: HourlyGroupRow[],
  hourTimestamp: number,
): HourlySummaryRecord[] {
  const summaryMap = new Map<string, {
    tenantId: string;
    licenseNonce: string;
    externalCustomerId: string | null;
    requests: number;
    credits: number;
    tokensInput: number;
    tokensOutput: number;
    errors: number;
    responseTimeSum: number;
    serviceMap: Map<string, {
      requests: number; credits: number;
      tokensInput: number; tokensOutput: number;
      errors: number; responseTimeSum: number;
    }>;
  }>();

  for (const row of groupedRows) {
    const key = `${row.user_id}:${row.license_nonce}`;
    let group = summaryMap.get(key);

    if (!group) {
      group = {
        tenantId: row.user_id,
        licenseNonce: row.license_nonce,
        externalCustomerId: row.external_customer_id,
        requests: 0, credits: 0, tokensInput: 0, tokensOutput: 0,
        errors: 0, responseTimeSum: 0,
        serviceMap: new Map(),
      };
      summaryMap.set(key, group);
    }

    group.requests += row.total_requests;
    group.credits += row.total_credits;
    group.tokensInput += row.total_tokens_input;
    group.tokensOutput += row.total_tokens_output;
    group.errors += row.total_errors;
    if (row.avg_response_time_ms !== null) {
      group.responseTimeSum += row.avg_response_time_ms * row.total_requests;
    }

    let svc = group.serviceMap.get(row.service_name);
    if (!svc) {
      svc = { requests: 0, credits: 0, tokensInput: 0, tokensOutput: 0, errors: 0, responseTimeSum: 0 };
      group.serviceMap.set(row.service_name, svc);
    }
    svc.requests += row.total_requests;
    svc.credits += row.total_credits;
    svc.tokensInput += row.total_tokens_input;
    svc.tokensOutput += row.total_tokens_output;
    svc.errors += row.total_errors;
    if (row.avg_response_time_ms !== null) {
      svc.responseTimeSum += row.avg_response_time_ms * row.total_requests;
    }
  }

  const results: HourlySummaryRecord[] = [];

  for (const [, group] of summaryMap.entries()) {
    const serviceBreakdown: ServiceBreakdownItem[] = Array.from(group.serviceMap.entries()).map(
      ([serviceName, stats]) => ({
        service: serviceName,
        requests: stats.requests,
        credits: stats.credits,
        tokens_input: stats.tokensInput,
        tokens_output: stats.tokensOutput,
        errors: stats.errors,
        avg_response_time_ms: calcAvgResponseTime(stats.responseTimeSum, stats.requests),
      })
    );

    results.push({
      hourTimestamp,
      tenantId: group.tenantId,
      licenseNonce: group.licenseNonce,
      externalCustomerId: group.externalCustomerId,
      totalRequests: group.requests,
      totalCredits: group.credits,
      totalTokensInput: group.tokensInput,
      totalTokensOutput: group.tokensOutput,
      totalErrors: group.errors,
      avgResponseTimeMs: calcAvgResponseTime(group.responseTimeSum, group.requests),
      serviceBreakdown,
    });
  }

  return results;
}
