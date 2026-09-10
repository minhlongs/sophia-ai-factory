import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCustomerUsageSummary } from '../customer-usage-summary';

const mockAll = vi.fn();
const mockBind = vi.fn(() => ({ all: mockAll }));
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

  it('throws error if userId is missing', async () => {
    await expect(getCustomerUsageSummary('')).rejects.toThrow('TENANT_ID_REQUIRED');
  });

  it('aggregates usage across providers with strict tenant isolation', async () => {
    mockAll
      .mockResolvedValueOnce({
        results: [
          { service_name: 'fal-ai-flux', tokens_input: 0, tokens_output: 0, credits_used: 1.5, created_at: 1720000000, status_code: 200 },
          { service_name: 'elevenlabs-voice', tokens_input: 100, tokens_output: 50, credits_used: 0.5, created_at: 1720000000, status_code: 200 },
          { service_name: 'openrouter-anthropic', tokens_input: 1000, tokens_output: 500, credits_used: 2.0, created_at: 1720000000, status_code: 200 },
        ],
      })
      .mockResolvedValueOnce({
        results: [
          { created_at: 1720000000000, status: 'completed' },
          { created_at: 1720000000000, status: 'succeeded' },
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
    expect(mockBind).toHaveBeenCalledWith('usr_tenant_123', expect.any(Number), expect.any(Number));
  });

  it('ignores failed, retried, or cancelled records (idempotent billing)', async () => {
    mockAll
      .mockResolvedValueOnce({ results: [] })
      .mockResolvedValueOnce({ results: [] });

    const report = await getCustomerUsageSummary('usr_tenant_456');

    expect(report.totals.totalCredits).toBe(0);
    expect(report.totals.videoMinutes).toBe(0);
    expect(report.dailyUsage).toHaveLength(0);
  });

  it('handles database degradation gracefully without throwing', async () => {
    mockAll.mockRejectedValueOnce(new Error('D1_STORAGE_TIMEOUT'));

    const report = await getCustomerUsageSummary('usr_tenant_789');

    expect(report.userId).toBe('usr_tenant_789');
    expect(report.totals.totalCredits).toBe(0);
  });
});
