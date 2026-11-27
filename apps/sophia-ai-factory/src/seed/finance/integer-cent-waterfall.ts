/**
 * Multi-Tenant Agency & Sub-Affiliate Integer-Cent Revenue Split Waterfall.
 *
 * Clean-room pure-TS BigInt engine (MIT patterns from adamburmister/pluts,
 * dinerojs/dinero.js, and didrod205/pennywise):
 * - Zero floating-point drift using `bigint` minor units (cents).
 * - Deterministic largest-remainder allocation guaranteeing `sum(parts) === totalCents`.
 * - Balanced double-entry leg verification (`sum(debits) === sum(credits)`).
 *
 * Layer: seed/finance (pure BigInt math, zero external deps)
 *
 * @module seed/finance/integer-cent-waterfall
 */

export interface WaterfallShareInput {
  readonly participantId: string;
  readonly role: 'creator' | 'va_editor' | 'agency';
  /** Basis points (e.g., 7000 = 70.00%). Total across participants must equal 10000. */
  readonly basisPoints: number;
}

export interface WaterfallAllocation {
  readonly participantId: string;
  readonly role: 'creator' | 'va_editor' | 'agency';
  readonly cents: bigint;
  readonly formattedUsd: string;
}

export interface WaterfallStatement {
  readonly totalCents: bigint;
  readonly allocations: readonly WaterfallAllocation[];
  readonly balanced: boolean;
}

export function formatCentsUsd(cents: bigint): string {
  const neg = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  const dollars = abs / 100n;
  const rem = (abs % 100n).toString().padStart(2, '0');
  return `${neg}$${dollars.toString()}.${rem}`;
}

export function allocateIntegerCentWaterfall(
  totalCents: bigint,
  shares: readonly WaterfallShareInput[],
): WaterfallStatement {
  if (totalCents < 0n) {
    throw new Error('totalCents must be non-negative');
  }
  const active = shares.filter((s) => s.basisPoints > 0);
  const totalBps = active.reduce((acc, s) => acc + s.basisPoints, 0);
  if (totalBps !== 10_000) {
    throw new Error(`Waterfall basisPoints must sum to 10000 (got ${totalBps})`);
  }

  const totalBpsBig = 10_000n;
  const raw = active.map((s, idx) => {
    const numerator = totalCents * BigInt(s.basisPoints);
    return {
      idx,
      share: s,
      base: numerator / totalBpsBig,
      remainder: numerator % totalBpsBig,
    };
  });

  const allocatedBase = raw.reduce((acc, item) => acc + item.base, 0n);
  let leftover = totalCents - allocatedBase;

  // Largest-remainder deterministic tie-break (descending remainder, then original order)
  const byRemainder = [...raw].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder > a.remainder ? 1 : -1;
    return a.idx - b.idx;
  });

  const bonusByIdx = new Map<number, bigint>();
  for (const item of byRemainder) {
    if (leftover <= 0n) break;
    bonusByIdx.set(item.idx, 1n);
    leftover -= 1n;
  }

  const allocations: WaterfallAllocation[] = raw.map((item) => {
    const cents = item.base + (bonusByIdx.get(item.idx) ?? 0n);
    return {
      participantId: item.share.participantId,
      role: item.share.role,
      cents,
      formattedUsd: formatCentsUsd(cents),
    };
  });

  const sumCredits = allocations.reduce((acc, a) => acc + a.cents, 0n);
  return {
    totalCents,
    allocations,
    balanced: sumCredits === totalCents,
  };
}
