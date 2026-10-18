import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.resetModules();
});

async function importHelpers(internalSecret: string, fallbackSecret: string) {
  vi.stubEnv('INTERNAL_SECRET', internalSecret);
  vi.stubEnv('X_INTERNAL_SECRET', fallbackSecret);
  vi.resetModules();
  return import('./finance-report-helpers');
}

function requestWithSecret(secret: string): NextRequest {
  return new NextRequest('https://example.test/api/admin/finance/report', {
    headers: { 'x-internal-secret': secret },
  });
}

function fakeD1(revenueRow: unknown, previousRow: unknown) {
  const first = vi.fn()
    .mockResolvedValueOnce(revenueRow)
    .mockResolvedValueOnce(previousRow);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare }, prepare, bind, first };
}

describe('finance report helpers', () => {
  it('rejects requests when no internal secret is configured', async () => {
    const { requireInternal } = await importHelpers('', '');
    const response = requireInternal(requestWithSecret('anything'));
    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({ error: 'unauthorized' });
  });

  it('uses the fallback secret and accepts only an exact matching request header', async () => {
    const { requireInternal } = await importHelpers('', 'fallback-secret');
    expect(requireInternal(requestWithSecret('fallback-secret'))).toBeNull();
    expect(requireInternal(requestWithSecret('wrong-secret'))?.status).toBe(401);
    expect(requireInternal(requestWithSecret(''))?.status).toBe(401);
  });

  it('parses explicit ranges and defaults to the first day of the current month', async () => {
    const { parsePeriod } = await importHelpers('unused', '');
    const explicit = parsePeriod('2026-09-10T00:00:00Z', '2026-10-01T00:00:00Z');
    expect(explicit.fromSec).toBe(Date.parse('2026-09-10T00:00:00Z') / 1000);
    expect(explicit.toSec).toBe(Date.parse('2026-10-01T00:00:00Z') / 1000);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
    const defaults = parsePeriod('', '');
    expect(defaults.from.toISOString()).toBe(new Date(2026, 9, 1).toISOString());
    expect(defaults.to.toISOString()).toBe('2026-10-18T12:00:00.000Z');
  });

  it('calculates positive revenue metrics and binds both current and prior period queries', async () => {
    vi.stubEnv('FINANCE_MONTHLY_BURN_USD', '3000');
    vi.stubEnv('FINANCE_CAC_USD', '100');
    const { generateFinanceReportData } = await importHelpers('unused', '');
    const { db, prepare, bind, first } = fakeD1(
      { gross_debits: 100_000, credits: 0, tx_count: 6 },
      { prev_revenue: 500 },
    );
    const from = new Date('2026-09-01T00:00:00Z');
    const to = new Date('2026-10-01T00:00:00Z');

    const report = await generateFinanceReportData(
      db as never, 'month', from.getTime() / 1000, to.getTime() / 1000, from, to,
    );

    expect(prepare).toHaveBeenCalledTimes(2);
    expect(bind).toHaveBeenNthCalledWith(1, from.getTime() / 1000, to.getTime() / 1000);
    expect(bind).toHaveBeenNthCalledWith(2, Date.parse('2026-08-01T00:00:00Z') / 1000, Date.parse('2026-08-31T00:00:00Z') / 1000);
    expect(first).toHaveBeenCalledTimes(2);
    expect(report).toMatchObject({
      period: 'month', from: '2026-09-01', to: '2026-10-01',
      pnl: { revenue: 100_000, cogs: 15_000, gross_profit: 85_000, gross_margin_pct: 85, opex: 3000, net: 82_000, net_margin_pct: 82 },
      mrr_waterfall: { start: 500, new: 15_000, expansion: 5000, churn: 15, contraction: 10, end: 97_500 },
      metrics: { active_customers: 2, arpu: 50_000, ltv: 1_428_571, cac: 100, churn_rate: 3.5, ltv_cac: 14_285.7, tx_count: 6 },
    });
    expect(report.notes).toHaveLength(4);
  });

  it('returns zero margins and conservative metric defaults when queries have no rows', async () => {
    vi.stubEnv('FINANCE_MONTHLY_BURN_USD', '45000');
    vi.stubEnv('FINANCE_CAC_USD', '0');
    const { generateFinanceReportData } = await importHelpers('unused', '');
    const { db } = fakeD1(null, null);
    const from = new Date('2026-10-01T00:00:00Z');
    const to = new Date('2026-10-31T00:00:00Z');

    const report = await generateFinanceReportData(
      db as never, 'custom', 0, 0, from, to,
    );

    expect(report.pnl).toMatchObject({ revenue: 0, cogs: 0, gross_profit: 0, gross_margin_pct: 0, net_margin_pct: 0 });
    expect(report.metrics).toMatchObject({ active_customers: 1, arpu: 0, ltv: 0, cac: 0, ltv_cac: 0, tx_count: 0 });
    expect(report.mrr_waterfall).toMatchObject({ start: 0, end: 0 });
  });
});
