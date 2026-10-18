/**
 * Daily Rollup Grouper — groups hourly summaries by tenant and license nonce
 */

import type { DailySummaryRecord, HourlySummaryRow, ServiceBreakdownItem } from './rollup-utils';

export type GroupAccumulator = {
  tenantId: string;
  licenseNonce: string;
  externalCustomerId: string | null;
  requests: number;
  credits: number;
  tokensInput: number;
  tokensOutput: number;
  errors: number;
  responseTimeSum: number;
  count: number;
  hourlyBreakdown: DailySummaryRecord['hourlyBreakdown'];
  serviceMap: Map<string, { requests: number; credits: number; tokensInput: number; tokensOutput: number; errors: number }>;
};

export function groupHourlySummaries(hourlySummaries: HourlySummaryRow[]): Map<string, GroupAccumulator> {
  const grouped = new Map<string, GroupAccumulator>();

  for (const hourly of hourlySummaries) {
    const key = `${hourly.tenant_id}:${hourly.license_nonce}`;
    let group = grouped.get(key);

    if (!group) {
      group = {
        tenantId: hourly.tenant_id,
        licenseNonce: hourly.license_nonce,
        externalCustomerId: hourly.external_customer_id,
        requests: 0, credits: 0, tokensInput: 0, tokensOutput: 0,
        errors: 0, responseTimeSum: 0, count: 0,
        hourlyBreakdown: [],
        serviceMap: new Map(),
      };
      grouped.set(key, group);
    }

    group.requests += hourly.total_requests;
    group.credits += hourly.total_credits;
    group.tokensInput += hourly.total_tokens_input;
    group.tokensOutput += hourly.total_tokens_output;
    group.errors += hourly.total_errors;
    group.responseTimeSum += hourly.avg_response_time_ms * hourly.total_requests;
    group.count += 1;

    group.hourlyBreakdown.push({
      hour: hourly.hour_timestamp,
      requests: hourly.total_requests,
      credits: hourly.total_credits,
      tokensInput: hourly.total_tokens_input,
      tokensOutput: hourly.total_tokens_output,
      errors: hourly.total_errors,
    });

    const services = Array.isArray(hourly.service_breakdown)
      ? (hourly.service_breakdown as ServiceBreakdownItem[])
      : [];
    for (const svc of services) {
      let svcStats = group.serviceMap.get(svc.service);
      if (!svcStats) {
        svcStats = { requests: 0, credits: 0, tokensInput: 0, tokensOutput: 0, errors: 0 };
        group.serviceMap.set(svc.service, svcStats);
      }
      svcStats.requests += svc.requests;
      svcStats.credits += svc.credits;
      svcStats.tokensInput += svc.tokens_input;
      svcStats.tokensOutput += svc.tokens_output;
      svcStats.errors += svc.errors;
    }
  }

  return grouped;
}
