import { describe, it, expect } from 'vitest';
import {
  validateSwapLineDraw,
  calculateSwapExecution,
} from '../central-bank-swap-engine';
import type { SovereignSwapLine, SwapExecutionRequest } from '@/seed/types/galactic-reserve';

describe('Central Bank Swap Engine Unit Tests', () => {
  const activeSwapLine: SovereignSwapLine = {
    id: 'swap_01',
    lineCode: 'SWAP_USD_EUR_001',
    primaryCentralBank: 'US_FED',
    counterpartyCentralBank: 'ECB',
    facilityType: 'BILATERAL',
    baseCurrency: 'USD',
    quoteCurrency: 'EUR',
    creditLimitCents: 10_000_000_000, // $100M
    drawnAmountCents: 2_000_000_000,  // $20M drawn
    interestSpreadBps: 25,            // 0.25%
    collateralHaircutBps: 150,        // 1.5%
    counterpartyRating: 'AAA',
    status: 'ACTIVE',
    expiresAt: '2028-12-31T23:59:59Z',
    createdAt: '2026-01-01T00:00:00Z',
  };

  it('validates draw amount within remaining credit limit', () => {
    const validDraw = validateSwapLineDraw(activeSwapLine, 5_000_000_000); // $50M
    expect(validDraw.valid).toBe(true);

    const overDraw = validateSwapLineDraw(activeSwapLine, 9_000_000_000); // $90M > available $80M
    expect(overDraw.valid).toBe(false);
    expect(overDraw.reason).toContain('exceeds available limit');
  });

  it('rejects draws on suspended swap lines or negative amounts', () => {
    const suspendedLine = { ...activeSwapLine, status: 'SUSPENDED' as const };
    const result = validateSwapLineDraw(suspendedLine, 1_000_000);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not active');

    const negativeResult = validateSwapLineDraw(activeSwapLine, -100);
    expect(negativeResult.valid).toBe(false);
    expect(negativeResult.reason).toContain('strictly greater than 0');
  });

  it('calculates swap execution under interest rate parity and collateral haircut', () => {
    const request: SwapExecutionRequest = {
      lineCode: activeSwapLine.lineCode,
      drawAmountCents: 1_000_000_000, // $10M
      tenorDays: 90,
      baseInterestRateBps: 500, // 5.0%
    };

    const spotRate = 0.92; // 1 USD = 0.92 EUR
    const quoteInterestRateBps = 350; // 3.5%

    const execution = calculateSwapExecution(activeSwapLine, request, spotRate, quoteInterestRateBps);

    expect(execution.executedBaseCents).toBe(1_000_000_000);
    expect(execution.convertedQuoteCents).toBe(920_000_000); // 10M * 0.92
    expect(execution.effectiveRate).toBeGreaterThan(0);
    // Haircut for AAA = 1.0 * 150 bps = 1.5%
    expect(execution.haircutDeductedCents).toBe(15_000_000); // 1.5% of $10M
    expect(execution.interestOwedCents).toBeGreaterThan(0);
    expect(execution.clearingProofSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
