/**
 * Affiliate Cohort LTV, Recurring Rebate & Integer-Cent CAC Payback Forecaster.
 *
 * Clean-room pure-TS BigInt engine (MIT patterns from The-Commercium/renewal,
 * bgits/customer-lifetime-value, and R3LJA/splitstream):
 * - Projects period-by-period survival decay and cumulative integer-cent
 *   recurring commissions (SaaS) or CEX fee rebates over a horizon.
 * - Computes exact CAC payback month and LTV:CAC ratio with zero float drift.
 *
 * Layer: seed/finance (pure deterministic cohort math, zero external deps)
 *
 * @module seed/finance/cohort-ltv-forecaster
 */

export interface CohortLtvInput {
  /** Monthly gross commission per active referred user in integer USD cents. */
  readonly monthlyCommissionCents: bigint;
  /** Acquisition cost per referred user in integer USD cents. */
  readonly cacCents: bigint;
  /** Monthly retention rate in basis points (e.g. 8500 = 85% monthly retention). */
  readonly monthlyRetentionBps: number;
  /** Forecast horizon in months (1..36). */
  readonly horizonMonths: number;
}

export interface CohortLtvForecast {
  readonly cumulativeLtvCents: bigint;
  readonly netProfitCents: bigint;
  readonly paybackMonth: number | null;
  readonly ltvToCacRatio: number;
}

export function forecastAffiliateCohortLtv(input: CohortLtvInput): CohortLtvForecast {
  if (input.monthlyCommissionCents < 0n || input.cacCents < 0n) {
    throw new Error('monthlyCommissionCents and cacCents must be non-negative');
  }
  const months = Math.max(1, Math.min(36, Math.floor(input.horizonMonths)));
  const retentionBps = BigInt(Math.max(0, Math.min(10_000, Math.round(input.monthlyRetentionBps))));

  let survivalBps = 10_000n;
  let cumulativeLtvCents = 0n;
  let paybackMonth: number | null = input.cacCents === 0n ? 1 : null;

  for (let m = 1; m <= months; m += 1) {
    const periodRev = (input.monthlyCommissionCents * survivalBps) / 10_000n;
    cumulativeLtvCents += periodRev;
    if (paybackMonth === null && cumulativeLtvCents >= input.cacCents) {
      paybackMonth = m;
    }
    survivalBps = (survivalBps * retentionBps) / 10_000n;
  }

  const ltvToCacRatio =
    input.cacCents > 0n
      ? Number(((cumulativeLtvCents * 100n) / input.cacCents)) / 100
      : Number(cumulativeLtvCents > 0n ? 99 : 0);

  return {
    cumulativeLtvCents,
    netProfitCents: cumulativeLtvCents - input.cacCents,
    paybackMonth,
    ltvToCacRatio,
  };
}
