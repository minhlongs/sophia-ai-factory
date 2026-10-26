import { describe, it, expect } from 'vitest';
import { okxClient } from '@/land/affiliates/scout/client-okx';
import { fetchLiveCexMarketPulse } from '@/land/affiliates/market-pulse/cex-public-market-pulse';
import { buildCexRebateComparisonMatrix } from '@/land/affiliates/market-pulse/cex-fee-rebate-matrix';
import {
  calculateSaasAffiliateMrrLtv,
  computeSaasRecurringBonus,
} from '@/land/affiliates/scout/scoring/saas-mrr-ltv-calculator';
import { CEX_AFFILIATE_REGISTRY } from '@/seed/config/cex-affiliate-registry';

describe('Dual-Niche Affiliate Engine: Crypto CEX & SaaS LTV', () => {
  it('executes okxClient with correct network and fail-open mock fixture when credentials missing', async () => {
    expect(okxClient.network).toBe('okx');

    const rows = await okxClient.fetch({}, 'tenant-01');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].productName).toContain('OKX');
    expect(rows[0].commissionPct).toBe(50);
    expect(rows[0].category).toBe('crypto_exchange');
  });

  it('contains valid endpoints and fee tiers for all 4 major CEX partners', () => {
    expect(CEX_AFFILIATE_REGISTRY.binance).toBeDefined();
    expect(CEX_AFFILIATE_REGISTRY.bybit).toBeDefined();
    expect(CEX_AFFILIATE_REGISTRY.okx).toBeDefined();
    expect(CEX_AFFILIATE_REGISTRY.bitget).toBeDefined();

    expect(CEX_AFFILIATE_REGISTRY.binance.publicTickerEndpoint).toContain('binance.vision');
    expect(CEX_AFFILIATE_REGISTRY.binance.defaultUserKickbackPct).toBe(20);
    expect(CEX_AFFILIATE_REGISTRY.okx.defaultUserKickbackPct).toBe(20);
  });

  it('computes annual CEX fee savings and rebate comparison matrix across all 4 exchanges', () => {
    const matrix = buildCexRebateComparisonMatrix({ binance: 20, okx: 25 });
    expect(matrix.length).toBe(4);

    const binanceRow = matrix.find((r) => r.exchange === 'binance');
    expect(binanceRow).toBeDefined();
    if (binanceRow) {
      expect(binanceRow.effectiveTakerFeePct).toBeLessThan(CEX_AFFILIATE_REGISTRY.binance.takerFeePct);
      expect(binanceRow.annualTraderSavingsUsdAt100kVol).toBeGreaterThan(0);
      expect(binanceRow.affiliateNetRebatePct).toBe(30);
    }
  });

  it('calculates SaaS MRR LTV bonus correctly with churn clipping', () => {
    const highRetention = calculateSaasAffiliateMrrLtv({
      monthlyArpuUsd: 100,
      commissionRatePct: 30,
      commissionDurationMonths: 12,
      monthlyChurnRate: 0.03,
    });

    expect(highRetention.affiliateLtvUsd).toBe(360);
    expect(highRetention.normalizedLtvScore).toBe(0.6);

    const highChurn = calculateSaasAffiliateMrrLtv({
      monthlyArpuUsd: 100,
      commissionRatePct: 30,
      commissionDurationMonths: 12,
      monthlyChurnRate: 0.25,
    });

    expect(highChurn.expectedActiveMonths).toBe(4);
    expect(highChurn.affiliateLtvUsd).toBe(120);
    expect(highChurn.normalizedLtvScore).toBeLessThan(highRetention.normalizedLtvScore);

    const bonus = computeSaasRecurringBonus({
      id: 'aff-saas-1',
      tenantId: 't1',
      network: 'partnerstack',
      externalId: 'ps-1',
      productName: 'CloudCRM AI',
      productUrl: 'https://cloudcrm.ai',
      commissionPct: 30,
      commissionFlatUsd: 100,
      category: 'b2b_saas',
      discoveredAt: new Date().toISOString(),
    });
    expect(bonus).toBeGreaterThan(0);
    expect(bonus).toBeLessThanOrEqual(0.08);
  });

  it('fetches or safely falls back on public market pulse without requiring operator API keys', async () => {
    const res = await fetchLiveCexMarketPulse();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.symbol).toBe('BTCUSDT');
      expect(res.value.spotPriceUsd).toBeGreaterThan(0);
      expect(typeof res.value.change24hPct).toBe('number');
      expect(['binance', 'okx', 'bybit', 'bitget']).toContain(res.value.sourceExchange);
    }
  });
});
