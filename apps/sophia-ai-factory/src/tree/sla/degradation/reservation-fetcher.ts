/**
 * SLA Degradation Reservation Fetcher & Incident ID Generator
 *
 * @module tree/sla/degradation/reservation-fetcher
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseGpuReservation,
  EnterpriseGpuReservationRow,
} from '@/seed/types/gpu-mesh';
import { mapRowToReservation } from '@/seed/types/gpu-mesh';
import { logger } from '@/seed/utils/logger-utility';

export function generateIncidentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sdi_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `sdi_${timestamp}${randomPart}`;
}

export async function fetchReservationsForEvaluation(
  db: D1Database,
  reservationId: string | undefined,
  now: number,
): Promise<EnterpriseGpuReservation[]> {
  try {
    if (reservationId) {
      const row = await db
        .prepare('SELECT * FROM enterprise_gpu_reservations WHERE id = ?1 LIMIT 1')
        .bind(reservationId)
        .first<EnterpriseGpuReservationRow>();

      return row ? [mapRowToReservation(row)] : [];
    }

    const { results } = await db
      .prepare(
        `SELECT * FROM enterprise_gpu_reservations
         WHERE status IN ('active', 'degraded')
           AND active_from <= ?1
           AND active_until > ?1`,
      )
      .bind(now)
      .all<EnterpriseGpuReservationRow>();

    return (results ?? []).map(mapRowToReservation);
  } catch (error) {
    logger.error('[sla-calculator] Error fetching active reservations', {
      error: String(error),
    });
    return [];
  }
}
