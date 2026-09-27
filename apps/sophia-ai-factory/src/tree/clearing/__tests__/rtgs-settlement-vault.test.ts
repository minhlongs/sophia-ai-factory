import { describe, it, expect } from 'vitest';
import {
  calculateMultilateralNetting,
  convertFxCorridor,
  type InterbankObligation,
} from '../rtgs-settlement-vault';
import type { CentralBankClearingNode, FxCorridor } from '@/seed/types/central-bank-clearing';

describe('RTGS Settlement Vault Unit Tests', () => {
  const mockNodes: Record<string, CentralBankClearingNode> = {
    FED_US: {
      id: 'node_1',
      bicCode: 'FED_US',
      institutionName: 'Federal Reserve Bank',
      jurisdiction: 'US',
      rtgsNetwork: 'FEDWIRE',
      clearingStatus: 'ACTIVE',
      settlementCurrency: 'USD',
      creditLineCents: 10_000_000_000,
      currentBalanceCents: 5_000_000_000,
      lastSettlementAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    TARGET_EU: {
      id: 'node_2',
      bicCode: 'TARGET_EU',
      institutionName: 'European Central Bank',
      jurisdiction: 'EU',
      rtgsNetwork: 'TARGET2',
      clearingStatus: 'ACTIVE',
      settlementCurrency: 'EUR',
      creditLineCents: 10_000_000_000,
      currentBalanceCents: 5_000_000_000,
      lastSettlementAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    MAS_SG: {
      id: 'node_3',
      bicCode: 'MAS_SG',
      institutionName: 'Monetary Authority of Singapore',
      jurisdiction: 'SG',
      rtgsNetwork: 'FAST_SG',
      clearingStatus: 'ACTIVE',
      settlementCurrency: 'SGD',
      creditLineCents: 5_000_000_000,
      currentBalanceCents: 2_000_000_000,
      lastSettlementAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  };

  it('calculates multilateral netting and compression ratio correctly', () => {
    const obligations: InterbankObligation[] = [
      { id: '1', debtorBic: 'FED_US', creditorBic: 'TARGET_EU', amountCents: 100_000_000, currency: 'USD' },
      { id: '2', debtorBic: 'TARGET_EU', creditorBic: 'MAS_SG', amountCents: 80_000_000, currency: 'USD' },
      { id: '3', debtorBic: 'MAS_SG', creditorBic: 'FED_US', amountCents: 70_000_000, currency: 'USD' },
    ];

    const result = calculateMultilateralNetting(obligations, mockNodes);

    expect(result.grossVolumeCents).toBe(250_000_000);
    // Net:
    // FED_US: -100M + 70M = -30M
    // TARGET_EU: +100M - 80M = +20M
    // MAS_SG: +80M - 70M = +10M
    // Net volume to settle is 30M
    expect(result.netVolumeCents).toBe(30_000_000);
    expect(result.compressionRatioPercentage).toBe(88.0); // (250 - 30) / 250 = 88%
    expect(result.settlementFeasible).toBe(true);
    expect(result.unfundedBics.length).toBe(0);
  });

  it('detects unfunded nodes when settlement requirement exceeds available credit', () => {
    const limitedNodes: Record<string, CentralBankClearingNode> = {
      ...mockNodes,
      FED_US: {
        ...mockNodes.FED_US,
        creditLineCents: 1_000,
        currentBalanceCents: 0,
      },
    };

    const obligations: InterbankObligation[] = [
      { id: '1', debtorBic: 'FED_US', creditorBic: 'TARGET_EU', amountCents: 50_000_000, currency: 'USD' },
    ];

    const result = calculateMultilateralNetting(obligations, limitedNodes);
    expect(result.settlementFeasible).toBe(false);
    expect(result.unfundedBics).toContain('FED_US');
  });

  it('converts FX corridor with configured spread and rate', () => {
    const corridor: FxCorridor = {
      id: 'c_usd_sgd',
      baseCurrency: 'USD',
      quoteCurrency: 'SGD',
      exchangeRateMicros: 1_350_000, // 1.35 SGD per USD
      intradayVolumeCents: 0,
      spreadBps: 2, // 0.02%
      isActive: true,
      updatedAt: new Date().toISOString(),
    };

    const res = convertFxCorridor(10_000_000, corridor); // $100,000 USD
    // Gross: 100,000 * 1.35 = 135,000 SGD = 13,500,000 cents
    // Fee: 13,500,000 * 0.0002 = 2,700 cents
    // Net: 13,497,300 cents
    expect(res.feeCents).toBe(2700);
    expect(res.convertedCents).toBe(13497300);
  });
});
