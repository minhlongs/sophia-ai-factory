import { describe, expect, it } from 'vitest';
import type { HourlyGroupRow } from './hourly-rollup-grouper';
import { buildHourlySummariesFromRows } from './hourly-rollup-grouper';

function row(overrides: Partial<HourlyGroupRow> = {}): HourlyGroupRow {
  return {
    user_id: 'tenant-1',
    license_nonce: 'license-a',
    external_customer_id: 'customer-1',
    service_name: 'video',
    total_requests: 1,
    total_credits: 10,
    total_tokens_input: 100,
    total_tokens_output: 200,
    total_errors: 0,
    avg_response_time_ms: 100,
    ...overrides,
  };
}

describe('buildHourlySummariesFromRows', () => {
  it('returns an empty result for no grouped rows', () => {
    expect(buildHourlySummariesFromRows([], 1_700_000_000)).toEqual([]);
  });

  it('combines rows by tenant and license with weighted overall and per-service latency', () => {
    const rows = [
      row({ total_requests: 2, total_credits: 20, total_tokens_input: 200, total_tokens_output: 300, total_errors: 1, avg_response_time_ms: 100 }),
      row({ total_requests: 1, total_credits: 5, total_tokens_input: 50, total_tokens_output: 80, total_errors: 1, avg_response_time_ms: 200 }),
      row({ service_name: 'chat', total_requests: 1, total_credits: 7, total_tokens_input: 20, total_tokens_output: 30, total_errors: 0, avg_response_time_ms: 50 }),
    ];

    expect(buildHourlySummariesFromRows(rows, 900)).toEqual([
      {
        hourTimestamp: 900,
        tenantId: 'tenant-1',
        licenseNonce: 'license-a',
        externalCustomerId: 'customer-1',
        totalRequests: 4,
        totalCredits: 32,
        totalTokensInput: 270,
        totalTokensOutput: 410,
        totalErrors: 2,
        avgResponseTimeMs: 112.5,
        serviceBreakdown: [
          {
            service: 'video',
            requests: 3,
            credits: 25,
            tokens_input: 250,
            tokens_output: 380,
            errors: 2,
            avg_response_time_ms: 133.33,
          },
          {
            service: 'chat',
            requests: 1,
            credits: 7,
            tokens_input: 20,
            tokens_output: 30,
            errors: 0,
            avg_response_time_ms: 50,
          },
        ],
      },
    ]);
  });

  it('creates separate summaries for each tenant-license pair and handles null or zero-request latency', () => {
    const rows = [
      row({ total_requests: 0, avg_response_time_ms: 300 }),
      row({ service_name: 'unknown-latency', total_requests: 2, avg_response_time_ms: null }),
      row({ user_id: 'tenant-2', license_nonce: 'license-a', external_customer_id: null }),
      row({ user_id: 'tenant-1', license_nonce: 'license-b', external_customer_id: 'customer-2' }),
    ];

    const summaries = buildHourlySummariesFromRows(rows, 901);

    expect(summaries).toHaveLength(3);
    expect(summaries[0]).toMatchObject({
      tenantId: 'tenant-1',
      licenseNonce: 'license-a',
      totalRequests: 2,
      avgResponseTimeMs: 0,
    });
    expect(summaries[0]?.serviceBreakdown).toEqual([
      expect.objectContaining({ service: 'video', requests: 0, avg_response_time_ms: 0 }),
      expect.objectContaining({ service: 'unknown-latency', requests: 2, avg_response_time_ms: 0 }),
    ]);
    expect(summaries[1]).toMatchObject({ tenantId: 'tenant-2', licenseNonce: 'license-a', externalCustomerId: null });
    expect(summaries[2]).toMatchObject({ tenantId: 'tenant-1', licenseNonce: 'license-b', externalCustomerId: 'customer-2' });
  });
});
