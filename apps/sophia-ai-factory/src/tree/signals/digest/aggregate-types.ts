/**
 * Types and numeric conversion helpers for D1 signals digest aggregates.
 */

export interface SignupStats {
  /** Count of tier_conversion events where props had from_tier='free'/'BASIC' */
  count: number;
}

export interface ConversionRow {
  to_tier: string;
  count: number;
}

export interface PaymentStats {
  success_count: number;
  failed_count: number;
  total_usd: number;
}

export interface ByokProviderRow {
  provider: string;
  call_count: number;
}

export interface AgentDispatchRow {
  /** campaign_id used as proxy for agent name in dispatch events */
  command: string;
  dispatch_count: number;
}

/** Returns unix ms timestamp for `daysAgo` days before now */
export function windowStart(daysAgo = 7): number {
  return Date.now() - daysAgo * 24 * 60 * 60 * 1000;
}

/** Safely parse integer from D1 result (may come as string or number) */
export function toInt(v: unknown): number {
  if (typeof v === 'number') return Math.round(v);
  if (typeof v === 'string') return parseInt(v, 10) || 0;
  return 0;
}

/** Safely parse float from D1 result */
export function toFloat(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}
