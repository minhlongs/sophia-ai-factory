/**
 * NOWPayments IPN One-Time Types and Helper Utilities
 *
 * Layer: land (Business domain workflows)
 * @module land/billing/ipn/types
 */

import type { NowPaymentsIpnPayload } from '../nowpayments-ipn-handlers';
import type { OneTimeSku } from '@/seed/types';
import type { Result } from '@/seed/types/result';
import type { IPNError } from '../nowpayments-ipn-errors';

export type { NowPaymentsIpnPayload, OneTimeSku, Result, IPNError };

export function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Clamp to last day of target month to prevent overflow (e.g. Jan 31 + 1 month)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDay, lastDay));
  return d;
}
