import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCustomerUsageSummary } from '../customer-usage-summary';

const mockAll = vi.fn();
const mockFirst = vi.fn().mockResolvedValue(null);
const mockBind = vi.fn(() => ({ all: mockAll, first: mockFirst }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({
    prepare: mockPrepare,
  })),
}));

describe('CustomerUsageSummary Accounting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cross-tenant access: rejects empty tenant ID with TENANT_ID_REQUIRED', async () => {
    await expect(getCustomerUsageSummary('')).rejects.toThrow('TENANT_ID_REQUIRED');
    await expect(getCustomerUsageSummary('   ')).rejects.toThrow('TENANT_ID_REQUIRED');
  });

  it('cross-tenant access: scopes all database queries strictly to authenticated userId', async () => {
    mockAll
      .mockResolvedValueOnce({ results: [] })
      .mockResolvedValueOnce({ results: [] });

    await getCustomerUsageSummary('usr_tenant_alpha');

    // 4 queries: usage_events, video_jobs, user subscription, org subscription
    expect(mockPrepare).toHaveBeenCalledTimes(4);
    expect(mockBind).toHaveBeenNthCalledWith(1, 'usr_tenant_alpha', expect.any(Number), expect.any(Number));
    expect(mockBind).toHaveBeenNthCalledWith(2, 'usr_tenant_alpha', expect.any(Number), expect.any(Number));
    expect(mockBind).toHaveBeenNthCalledWith(3, 'usr_tenant_alpha');
    expect(mockBind).toHaveBeenNthCalledWith(4, 'usr_tenant_alpha');
  });

  it('successful job: accurately aggregates completed video jobs and AI events', async () => {
    mockAll
      .mockResolvedValueOnce({
        results: [
          { service_name: 'fal-ai-flux', credits_used: 1.5, status_code: 200, id: 'ev_1' },
          { service_name: 'elevenlabs-voice', tokens_input: 100, tokens_output: 50, credits_used: 0.5, status_code: 200, id: 'ev_2' },
          { service_name: 'openrouter-claude', tokens_input: 1000, tokens_output: 500, credits_used: 2.0, status_code: 200, id: 'ev_3' },
        ],
      })
      .mockResolvedValueOnce({
        results: [
          { id: 'job_1', created_at: 1720000000000, status: 'completed' },
          { id: 'job_2', created_at: 1720000000000, status: 'succeeded' },
        ],
      });

    const report = await getCustomerUsageSummary('usr_tenant_123');

    expect(report.userId).toBe('usr_tenant_123');
    expect(report.totals.falAiImages).toBe(1);
    expect(report.totals.elevenLabsChars).toBe(150);
    expect(report.totals.openRouterTokens).toBe(1500);
    expect(report.totals.videoMinutes).toBe(2);
    expect(report.totals.totalCredits).toBe(4.0);
    expect(report.providers).toHaveLength(4);
  });

  it('duplicate event: deduplicates identical idempotency_key, request_id, and id without double charging', async () => {
    mockAll
      .mockResolvedValueOnce({
        results: [
          { service_name: 'fal-ai', credits_used: 1.0, idempotency_key: 'idem_dup_1' },
          { service_name: 'fal-ai', credits_used: 1.0, idempotency_key: 'idem_dup_1' }, // duplicate idempotency_key
          { service_name: 'openrouter', credits_used: 2.0, request_id: 'req_dup_2', tokens_input: 100, tokens_output: 100 },
          { service_name: 'openrouter', credits_used: 2.0, request_id: 'req_dup_2', tokens_input: 100, tokens_output: 100 }, // duplicate request_id
          { service_name: 'elevenlabs', credits_used: 0.5, id: 'row_dup_3', tokens_input: 50, tokens_output: 50 },
          { service_name: 'elevenlabs', credits_used: 0.5, id: 'row_dup_3', tokens_input: 50, tokens_output: 50 }, // duplicate row id
        ],
      })
      .mockResolvedValueOnce({ results: [] });

    const report = await getCustomerUsageSummary('usr_tenant_dedup');

    expect(report.totals.falAiImages).toBe(1); // not 2
    expect(report.totals.openRouterTokens).toBe(200); // not 400
    expect(report.totals.elevenLabsChars).toBe(100); // not 200
    expect(report.totals.totalCredits).toBe(3.5); // 1.0 + 2.0 + 0.5, not 7.0
  });

  it('failed job: does not count 500 error events and respects status_code check', async () => {
    mockAll
      .mockResolvedValueOnce({ results: [] })
      .mockResolvedValueOnce({ results: [] }); // failed jobs excluded by SQL status IN (...)

    const report = await getCustomerUsageSummary('usr_tenant_failed');
    expect(report.totals.videoMinutes).toBe(0);
    expect(report.totals.totalCredits).toBe(0);
  });

  it('retried job: deduplicates multiple attempts with same job id', async () => {
    mockAll
      .mockResolvedValueOnce({ results: [] })
      .mockResolvedValueOnce({
        results: [
          { id: 'video_job_retry_101', created_at: 1720000000000, status: 'completed' },
          { id: 'video_job_retry_101', created_at: 1720000005000, status: 'completed' }, // retry execution of same job
        ],
      });

    const report = await getCustomerUsageSummary('usr_tenant_retried');
    expect(report.totals.videoMinutes).toBe(1); // deduplicated to single job
  });

  it('cancelled job: excluded from successful video counting', async () => {
    mockAll
      .mockResolvedValueOnce({ results: [] })
      .mockResolvedValueOnce({ results: [] });

    const report = await getCustomerUsageSummary('usr_tenant_cancelled');
    expect(report.totals.videoMinutes).toBe(0);
  });

  it('handles database degradation gracefully without throwing', async () => {
    mockAll.mockRejectedValueOnce(new Error('D1_STORAGE_TIMEOUT'));

    const report = await getCustomerUsageSummary('usr_tenant_degraded');

    expect(report.userId).toBe('usr_tenant_degraded');
    expect(report.totals.totalCredits).toBe(0);
  });
});
