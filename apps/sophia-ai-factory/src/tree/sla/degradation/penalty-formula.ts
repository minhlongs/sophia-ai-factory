import type {
  EnterpriseGpuReservation,
  BreachType,
  CompensationRail,
} from '@/seed/types/gpu-mesh';
import { GPU_MESH_SLA_CONFIG } from '@/seed/config/gpu-mesh';

/**
 * Calculate P95 latency from an array of millisecond values (pure function)
 */
export function calculateP95Latency(latencies: number[]): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);
  // Cap at max valid index
  const index = Math.min(p95Index, sorted.length - 1);
  return sorted[index];
}

/**
 * Calculate availability ratio from successful and total job counts (pure function)
 */
export function calculateAvailability(successfulJobs: number, totalJobs: number): number {
  if (totalJobs <= 0) return 1.0;
  return Math.min(1.0, Math.max(0.0, successfulJobs / totalJobs));
}

/**
 * Calculate dual-rail compensation for an SLA breach (pure function)
 */
export function calculateSlaCompensation(
  reservation: EnterpriseGpuReservation,
  breachType: BreachType,
  impactedJobsCount: number,
  rail: CompensationRail = 'MCU_CREDIT',
): { creditAmountCents: number; compensationMcu: number } {
  const refundPct = reservation.slaRefundPct || GPU_MESH_SLA_CONFIG.defaultRefundPct;

  // Base compensation: % of monthly allocation
  const baseMcuCompensation = Math.round(
    reservation.mcuMonthlyAllocation * (refundPct / 100),
  );

  // Per-impacted-job bonus (e.g. 500 MCU per directly impacted job)
  const jobImpactBonusMcu = Math.max(0, impactedJobsCount) * 500;
  const totalMcu = baseMcuCompensation + jobImpactBonusMcu;

  // Contract monthly price in cents from metadata, or standard enterprise pricing:
  // Default is $0.005 per MCU (50 cents per 1,000 MCU)
  const metadataPriceCents =
    typeof reservation.metadata?.monthlyPriceCents === 'number'
      ? reservation.metadata.monthlyPriceCents
      : null;

  const estimatedMonthlyCents =
    metadataPriceCents ?? Math.round((reservation.mcuMonthlyAllocation / 1000) * 50);

  const baseCentsCompensation = Math.round(estimatedMonthlyCents * (refundPct / 100));
  const jobImpactBonusCents = Math.max(0, impactedJobsCount) * 25; // 25 cents per impacted job
  const totalCents = baseCentsCompensation + jobImpactBonusCents;

  if (rail === 'USDT_REFUND' || rail === 'INVOICE_CREDIT') {
    return {
      creditAmountCents: totalCents,
      compensationMcu: totalMcu,
    };
  }

  // Default MCU Credit rail
  return {
    creditAmountCents: totalCents,
    compensationMcu: totalMcu,
  };
}
