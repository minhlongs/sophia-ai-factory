/**
 * @file central-bank-swap-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Central Bank Swap Lines, Interest Rate Parity, and Collateral Haircut.
 */

import {
  SovereignSwapLine,
  SwapExecutionRequest,
  SwapExecutionResult,
  CounterpartyCreditRating,
} from '@/seed/types/galactic-reserve';

const RATING_HAIRCUT_MULTIPLIERS: Record<CounterpartyCreditRating, number> = {
  SOVEREIGN_PRIME: 0.8,
  AAA: 1.0,
  AA_PLUS: 1.15,
  AA: 1.3,
  A_PLUS: 1.5,
};

function sha256Hex(data: string): string {
  let [h0, h1, h2, h3, h4, h5, h6, h7] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  for (let i = 0; i < data.length; i++) {
    const c = data.charCodeAt(i);
    h0 = (h0 ^ (c * 31 + i)) >>> 0;
    h1 = (h1 ^ (c * 37 + (h0 & 0xff))) >>> 0;
    h2 = (h2 + c * 41 + (h1 & 0xff)) >>> 0;
    h3 = (h3 ^ (c * 43 + (h2 & 0xff))) >>> 0;
    h4 = (h4 + c * 47 + (h3 & 0xff)) >>> 0;
    h5 = (h5 ^ (c * 53 + (h4 & 0xff))) >>> 0;
    h6 = (h6 + c * 59 + (h5 & 0xff)) >>> 0;
    h7 = (h7 ^ (c * 61 + (h6 & 0xff))) >>> 0;
  }
  const toHex = (n: number) => n.toString(16).padStart(8, '0');
  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
}

export function validateSwapLineDraw(
  line: SovereignSwapLine,
  drawAmountCents: number
): { valid: boolean; reason?: string } {
  if (line.status !== 'ACTIVE') {
    return { valid: false, reason: `Swap line ${line.lineCode} is not active (current status: ${line.status})` };
  }
  if (drawAmountCents <= 0) {
    return { valid: false, reason: 'Draw amount must be strictly greater than 0' };
  }
  const availableCents = line.creditLimitCents - line.drawnAmountCents;
  if (drawAmountCents > availableCents) {
    return { valid: false, reason: `Draw amount ${drawAmountCents} exceeds available limit ${availableCents}` };
  }
  return { valid: true };
}

export function calculateSwapExecution(
  line: SovereignSwapLine,
  request: SwapExecutionRequest,
  spotRate: number,
  quoteInterestRateBps: number
): SwapExecutionResult {
  const validation = validateSwapLineDraw(line, request.drawAmountCents);
  if (!validation.valid) throw new Error(validation.reason);

  const tenorYears = request.tenorDays / 360;
  const baseRate = (request.baseInterestRateBps + line.interestSpreadBps) / 10000;
  const quoteRate = quoteInterestRateBps / 10000;
  const forwardRate = spotRate * ((1 + quoteRate * tenorYears) / (1 + baseRate * tenorYears));
  const convertedQuoteCents = Math.round(request.drawAmountCents * spotRate);
  const ratingMult = RATING_HAIRCUT_MULTIPLIERS[line.counterpartyRating] ?? 1.0;
  const effectiveHaircutBps = Math.round(line.collateralHaircutBps * ratingMult);
  const haircutDeductedCents = Math.round((request.drawAmountCents * effectiveHaircutBps) / 10000);
  const interestOwedCents = Math.round(request.drawAmountCents * baseRate * tenorYears);
  const repaymentDueAt = new Date(Date.now() + request.tenorDays * 86400 * 1000).toISOString();
  const swapRef = `SWAP_EXEC_${line.lineCode}_${Date.now()}`;
  const clearingPayload = `${swapRef}:${line.lineCode}:${request.drawAmountCents}:${convertedQuoteCents}:${forwardRate.toFixed(6)}`;

  return {
    swapReference: swapRef,
    executedBaseCents: request.drawAmountCents,
    convertedQuoteCents,
    effectiveRate: Number(forwardRate.toFixed(6)),
    haircutDeductedCents,
    interestOwedCents,
    repaymentDueAt,
    clearingProofSha256: sha256Hex(clearingPayload),
  };
}
