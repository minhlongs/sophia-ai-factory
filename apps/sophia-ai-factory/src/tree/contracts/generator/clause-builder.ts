/**
 * Enterprise SLA Clause & Remedy Calculation
 *
 * Implements uptime commitment math, permitted downtime limits,
 * and service credit remedy schedules.
 *
 * Layer: tree (Pure domain logic — zero I/O)
 *
 * @module tree/contracts/generator/clause-builder
 */

import {
  SLA_SERVICE_CREDIT_SCHEDULE,
  DEFAULT_SLA_UPTIME_PERCENT,
} from '@/seed/types/enterprise-contracts';
import {
  AVERAGE_DAYS_PER_MONTH,
  type MonthlyPermittedDowntimeResult,
  type SlaServiceCreditResult,
} from './types';

/**
 * Calculate exact permitted downtime for a 99.9% availability commitment.
 */
export function calculateMonthlyPermittedDowntime(): MonthlyPermittedDowntimeResult {
  const totalMinutes = AVERAGE_DAYS_PER_MONTH * 24 * 60; // 43,830 minutes
  const allowedDowntimeFraction = (100 - DEFAULT_SLA_UPTIME_PERCENT) / 100; // 0.001 (0.1%)
  const totalDowntimeMinutes = totalMinutes * allowedDowntimeFraction; // 43.83 minutes
  const minutes = Math.floor(totalDowntimeMinutes);
  const seconds = Math.floor((totalDowntimeMinutes - minutes) * 60);

  return {
    totalMinutes,
    permittedDowntimeMinutes: totalDowntimeMinutes,
    permittedDowntimeSeconds: Math.floor(totalDowntimeMinutes * 60),
    formatted: `${minutes}m ${seconds}s`,
  };
}

/**
 * Determine applicable SLA service credit percentage based on actual monthly availability.
 */
export function resolveSlaServiceCredit(uptimePercent: number): SlaServiceCreditResult {
  const clampedUptime = Math.max(0, Math.min(100, uptimePercent));

  for (const tier of SLA_SERVICE_CREDIT_SCHEDULE) {
    if (clampedUptime >= tier.minAvailabilityPercent && clampedUptime <= tier.maxAvailabilityPercent) {
      return {
        creditPercent: tier.creditPercent,
        remedyTier: tier,
      };
    }
  }

  // Fallback for sub-95% availability
  const fallbackTier = SLA_SERVICE_CREDIT_SCHEDULE[SLA_SERVICE_CREDIT_SCHEDULE.length - 1];
  return {
    creditPercent: fallbackTier.creditPercent,
    remedyTier: fallbackTier,
  };
}

/**
 * Format currency cents to USD formatted string.
 */
export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
