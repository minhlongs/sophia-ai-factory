/**
 * SQL update clause builder for Enterprise GPU Reservations
 *
 * @module land/enterprise/gpu-reservations/reservation-mutator-sql
 */

import type { UpdateReservationInput } from '@/seed/types/gpu-mesh';

export function buildReservationUpdateClauses(
  updates: UpdateReservationInput,
  existingMetadata: Record<string, unknown>,
  now: number,
): { setClauses: string[]; params: unknown[] } {
  const setClauses: string[] = ['updated_at = ?1'];
  const params: unknown[] = [now];

  const addField = (col: string, val: unknown) => {
    params.push(val);
    setClauses.push(`${col} = ?${params.length}`);
  };

  if (updates.status) addField('status', updates.status);
  if (typeof updates.reservedUnits === 'number') addField('reserved_units', updates.reservedUnits);
  if (typeof updates.concurrencyLimit === 'number') addField('concurrency_limit', updates.concurrencyLimit);
  if (typeof updates.mcuMonthlyAllocation === 'number') addField('mcu_monthly_allocation', updates.mcuMonthlyAllocation);
  if (typeof updates.priorityScore === 'number') addField('priority_score', updates.priorityScore);
  if (updates.primaryRegion) addField('primary_region', updates.primaryRegion);
  if (updates.fallbackRegions) addField('fallback_regions', JSON.stringify(updates.fallbackRegions));
  if (typeof updates.slaUptimeTarget === 'number') addField('sla_uptime_target', updates.slaUptimeTarget);
  if (typeof updates.slaP95LatencyMs === 'number') addField('sla_p95_latency_ms', updates.slaP95LatencyMs);
  if (typeof updates.slaRefundPct === 'number') addField('sla_refund_pct', updates.slaRefundPct);
  if (typeof updates.activeUntil === 'number') addField('active_until', updates.activeUntil);
  if (updates.allocatedProviders) addField('allocated_providers', JSON.stringify(updates.allocatedProviders));
  if (updates.metadata) {
    const merged = { ...existingMetadata, ...updates.metadata };
    addField('metadata', JSON.stringify(merged));
  }

  return { setClauses, params };
}
