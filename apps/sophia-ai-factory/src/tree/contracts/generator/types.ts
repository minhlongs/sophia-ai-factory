/**
 * Enterprise SLA Contract Generator Types & Constants
 *
 * Layer: tree (Pure domain logic — zero I/O)
 *
 * @module tree/contracts/generator/types
 */

import type { SlaRemedyTier } from '@/seed/types/enterprise-contracts';

/** Standard average month in days for SLA calculations (365.25 / 12) */
export const AVERAGE_DAYS_PER_MONTH = 30.4375;

/** Permitted monthly downtime display string matching 99.9% uptime target */
export const PERMITTED_MONTHLY_DOWNTIME_FORMATTED = '43m 49s';

export interface MonthlyPermittedDowntimeResult {
  totalMinutes: number;
  permittedDowntimeMinutes: number;
  permittedDowntimeSeconds: number;
  formatted: string;
}

export interface SlaServiceCreditResult {
  creditPercent: number;
  remedyTier: SlaRemedyTier;
}
